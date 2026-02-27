"""
Tesco Grocer Service

Implements the BaseGrocerService interface for Tesco's GraphQL grocery API.
"""

import logging
from decimal import Decimal
from typing import Optional

import requests

from .base import (
    BaseGrocerService,
    GrocerProduct,
    GrocerSearchResult,
    GrocerPrice,
    GrocerPromotion,
    PriceMeasure,
    parse_price_measure,
)


logger = logging.getLogger(__name__)


def _barcode_matches(ean: str, barcode: str) -> bool:
    """Check whether an EAN from a grocer API matches the requested barcode.

    Handles the one-zero GTIN-14 → EAN-13 conversion (e.g. Tesco stores
    EAN-13s as 14-digit GTINs with a leading zero).  We deliberately do NOT
    strip all leading zeros because that causes false positives for
    Sainsbury's own-brand barcodes such as 0000001697063 whose stripped form
    (1697063) could match entirely unrelated Tesco GTINs.
    """
    if ean == barcode:
        return True
    # GTIN-14 → EAN-13: the grocer returned a 14-digit code, query is 13-digit
    if len(ean) == 14 and ean.startswith("0") and ean[1:] == barcode:
        return True
    # EAN-13 → GTIN-14: the query is 14-digit, the grocer stored 13-digit
    if len(barcode) == 14 and barcode.startswith("0") and barcode[1:] == ean:
        return True
    return False


class TescoService(BaseGrocerService):
    """
    Service for fetching product data from Tesco's GraphQL API.
    """

    GROCER_ID = "tesco"
    GROCER_NAME = "Tesco"

    BASE_URL = "https://xapi.tesco.com/"

    # GraphQL query for product search
    SEARCH_QUERY = """query Search($query: String!, $page: Int = 1, $count: Int, $sortBy: String, $includeRestrictions: Boolean = true) {
  search(query: $query, page: $page, count: $count, sortBy: $sortBy) {
    pageInformation: info {
      totalCount: total
      pageNo: page
      pageSize
      __typename
    }
    results {
      node {
        ... on ProductType {
          id
          tpnb
          tpnc
          gtin
          title
          brandName
          shortDescription
          defaultImageUrl
          superDepartmentName
          departmentName
          aisleName
          shelfName
          productType
          sellers(type: TOP, limit: 1, offset: 0) {
            results {
              isForSale
              price {
                actual
                unitPrice
                unitOfMeasure
                __typename
              }
              promotions {
                description
                price {
                  beforeDiscount
                  afterDiscount
                  __typename
                }
                startDate
                endDate
                __typename
              }
              __typename
            }
            __typename
          }
          reviews {
            stats {
              noOfReviews
              overallRating
              __typename
            }
            __typename
          }
          restrictions @include(if: $includeRestrictions) {
            type
            message
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}"""

    # Override default headers for Tesco
    DEFAULT_HEADERS = {
        "Accept": "application/json",
        "Accept-Language": "en-GB",
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0",
        "Referer": "https://www.tesco.com/",
        "Origin": "https://www.tesco.com",
        "region": "UK",
        "language": "en-GB",
        "x-apikey": "TvOSZJHlEk0pjniDGQFAc9Q59WGAR4dA",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
    }
    
    # Tesco retries 500s, uses POST for GraphQL
    RETRY_STATUS_CODES = [429, 500, 502, 503, 504]
    RETRY_METHODS = ["POST"]

    def _make_request(self, payload: list) -> dict:
        """
        Make a GraphQL request to the Tesco API.

        Args:
            payload: GraphQL request payload (list of operations)

        Returns:
            JSON response as dict

        Raises:
            requests.RequestException: On API errors
        """
        trace_id = self._generate_trace_id()
        headers = {
            "traceid": f"{trace_id}:{self._generate_trace_id()}",
            "trkid": trace_id,
        }

        try:
            response = self.session.post(
                self.BASE_URL,
                json=payload,
                headers=headers,
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Tesco API error: {e}")
            raise

    def _parse_product(self, node: dict) -> GrocerProduct:
        """
        Parse a product from Tesco's GraphQL response format.

        Args:
            node: Raw product node from API

        Returns:
            Standardized GrocerProduct
        """
        # Get the first seller's pricing info
        sellers_data = node.get("sellers", {})
        seller_results = sellers_data.get("results", [])
        
        retail_price = None
        unit_price = None
        promotions = []
        is_available = False

        if seller_results:
            seller = seller_results[0]
            is_available = seller.get("isForSale", False)
            
            # Parse retail price
            price_data = seller.get("price", {})
            if price_data:
                actual_price = price_data.get("actual") or price_data.get("price")
                if actual_price is not None:
                    retail_price = GrocerPrice(
                        price=Decimal(str(actual_price)),
                        currency="GBP",
                        measure=PriceMeasure.UNIT,
                    )
                
                # Parse unit price
                unit_price_val = price_data.get("unitPrice")
                unit_of_measure = price_data.get("unitOfMeasure")
                if unit_price_val is not None:
                    unit_price = GrocerPrice(
                        price=Decimal(str(unit_price_val)),
                        currency="GBP",
                        measure=parse_price_measure(unit_of_measure),
                    )

            # Parse promotions
            for promo in seller.get("promotions", []):
                promo_price_data = promo.get("price", {})
                before_discount = promo_price_data.get("beforeDiscount")
                after_discount = promo_price_data.get("afterDiscount")
                
                promotions.append(
                    GrocerPromotion(
                        description=promo.get("description", ""),
                        original_price=Decimal(str(before_discount)) if before_discount else None,
                        promo_price=Decimal(str(after_discount)) if after_discount else None,
                        start_date=promo.get("startDate"),
                        end_date=promo.get("endDate"),
                    )
                )

        # If there's a promotion, mark the retail price as on sale
        if promotions and retail_price:
            retail_price.is_on_sale = True
            if promotions[0].original_price:
                retail_price.original_price = promotions[0].original_price

        # Build categories from hierarchy
        categories = []
        for cat_field in ["superDepartmentName", "departmentName", "aisleName", "shelfName"]:
            cat_value = node.get(cat_field)
            if cat_value:
                categories.append(cat_value)

        # Parse barcodes - Tesco uses GTIN
        barcodes = []
        gtin = node.get("gtin")
        if gtin:
            barcodes.append(str(gtin))

        # Parse reviews
        reviews_data = node.get("reviews", {})
        stats = reviews_data.get("stats", {})
        rating = stats.get("overallRating")
        review_count = stats.get("noOfReviews")

        # Build product URL
        product_id = node.get("id", "")
        title_slug = (node.get("title") or "").lower().replace(" ", "-").replace("/", "-")
        product_url = f"https://www.tesco.com/groceries/en-GB/products/{product_id}" if product_id else None

        return GrocerProduct(
            grocer_id=self.GROCER_ID,
            product_id=str(product_id),
            name=node.get("title", ""),
            description=node.get("shortDescription", "") or "",
            brand=node.get("brandName"),
            barcodes=barcodes,
            retail_price=retail_price,
            unit_price=unit_price,
            is_available=is_available,
            categories=categories,
            image_url=node.get("defaultImageUrl"),
            thumbnail_url=node.get("defaultImageUrl"),
            promotions=promotions,
            product_url=product_url,
            rating=float(rating) if rating else None,
            review_count=int(review_count) if review_count else None,
            raw_data=node,
        )

    def search_products(
        self,
        query: str,
        page: int = 1,
        page_size: int = 20,
    ) -> GrocerSearchResult:
        """
        Search for products on Tesco.

        Args:
            query: Search term
            page: Page number (1-indexed)
            page_size: Results per page

        Returns:
            GrocerSearchResult with matching products
        """
        # Build GraphQL payload
        payload = [
            {
                "extensions": {"mfeName": "mfe-plp"},
                "operationName": "Search",
                "query": self.SEARCH_QUERY,
                "variables": {
                    "query": query,
                    "page": page,
                    "count": page_size,
                    "sortBy": "relevance",
                    "includeRestrictions": True,
                },
            }
        ]

        try:
            response_data = self._make_request(payload)
        except requests.RequestException as e:
            logger.error(f"Tesco search error: {e}")
            return GrocerSearchResult(
                products=[],
                total_count=0,
                page=page,
                page_size=page_size,
                has_more=False,
            )

        # Parse response - it's an array with one result
        if not response_data or not isinstance(response_data, list):
            return GrocerSearchResult(
                products=[],
                total_count=0,
                page=page,
                page_size=page_size,
                has_more=False,
            )

        search_data = response_data[0].get("data", {}).get("search", {})
        
        # Get page information
        page_info = search_data.get("pageInformation", {})
        total_count = page_info.get("totalCount", 0)
        current_page = page_info.get("pageNo", page)
        actual_page_size = page_info.get("pageSize", page_size)

        # Parse products
        products = []
        results = search_data.get("results", [])
        
        for result in results:
            node = result.get("node", {})
            if not node:
                continue
            try:
                product = self._parse_product(node)
                products.append(product)
            except Exception as e:
                logger.warning(f"Failed to parse Tesco product: {e}")
                continue

        # Calculate if there are more pages
        total_pages = (total_count + actual_page_size - 1) // actual_page_size if actual_page_size > 0 else 1
        has_more = current_page < total_pages

        return GrocerSearchResult(
            products=products,
            total_count=total_count,
            page=current_page,
            page_size=actual_page_size,
            has_more=has_more,
        )

    def get_product_by_id(self, product_id: str) -> Optional[GrocerProduct]:
        """
        Get a specific product by its Tesco product ID.

        Note: Tesco doesn't have a direct product lookup endpoint,
        so this searches for the product ID.

        Args:
            product_id: Tesco product ID

        Returns:
            GrocerProduct if found, None otherwise
        """
        result = self.search_products(product_id, page_size=10)

        for product in result.products:
            if product.product_id == product_id:
                return product

        return None

    def get_product_by_barcode(self, barcode: str) -> Optional[GrocerProduct]:
        """
        Get a product by its barcode/EAN/GTIN.

        Args:
            barcode: EAN/UPC/GTIN barcode

        Returns:
            GrocerProduct if found, None otherwise
        """
        result = self.search_products(barcode, page_size=20)

        for product in result.products:
            for ean in product.barcodes:
                if _barcode_matches(ean, barcode):
                    return product

        return None
