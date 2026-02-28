"""
Sainsbury's Grocer Service

Implements the BaseGrocerService interface for Sainsbury's grocery API.
"""

import logging
import time
from decimal import Decimal
from typing import Optional
from urllib.parse import quote

import requests

from .base import (
    BaseGrocerService,
    GrocerProduct,
    GrocerSearchResult,
    GrocerPrice,
    GrocerPromotion,
    parse_price_measure,
)


logger = logging.getLogger(__name__)


def _barcode_matches(ean: str, barcode: str) -> bool:
    """Check whether an EAN from a grocer API matches the requested barcode.

    Handles the one-zero GTIN-14 → EAN-13 conversion.  We deliberately do NOT
    strip all leading zeros because that causes false positives for
    Sainsbury's own-brand barcodes such as 0000001697063 whose stripped form
    (1697063) could match entirely unrelated products at other retailers.
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


class SainsburysService(BaseGrocerService):
    """
    Service for fetching product data from Sainsbury's API.
    
    Note: Sainsbury's has strong anti-bot measures. This service uses
    browser-like headers and retry logic to handle rate limiting.
    """
    
    GROCER_ID = "sainsburys"
    GROCER_NAME = "Sainsbury's"
    
    BASE_URL = "https://www.sainsburys.co.uk/groceries-api/gol-services/product/v1"
    
    # Feature flags required by Sainsbury's API (extracted from browser requests)
    FEATURE_FLAGS = (
        "add_to_favourites,use_food_basket_service,use_food_basket_service_v3,"
        "ads_conditionals,findability_v5,show_static_cnc_messaging,fetch_future_slot_weeks,"
        "click_and_collect_promo_banner,cookie_law_link,citrus_banners,"
        "citrus_favourites_trio_banners,offers_strategic_magnolia,special_logo,"
        "custom_product_messaging,promotional_link,promotional_link2,promotion_mechanics_page,"
        "findability_search,findability_autosuggest,fto_header_flag,"
        "recurring_slot_skip_opt_out,seasonal_favourites,cnc_start_amend_order_modal,"
        "favourites_product_cta_alt,get_favourites_from_v2,krang_alternatives,offers_config,"
        "alternatives_modal,relevancy_rank,changes_to_trolley,nectar_destination_page,"
        "meal_deal_live,browse_pills_nav_type,use_cached_findability_results,event_zone_list,"
        "cms_carousel_zone_list,show_ynp_change_slot_banner,recipe_scrapbooks_enabled,"
        "event_carousel_skus,split_savings,trolley_nectar_card,favourites_magnolia,homepage,"
        "taggstar,meal_deal_cms_template_ids,pdp_accordions,pdp_meta_desc_template,"
        "grouped_meal_deals,pci_phase_2,meal_deal_builder_nectar_widget,occasions_navigation,"
        "slots_event_banner_config,sales_window,resting_search,brands_background,"
        "brands_background_config,taggstar_config,all_ad_components_enabled,left_align_header,"
        "golui_my_addresses,new_global_header,new_filter_pages,spoonguru_disclaimers,"
        "recipe_reviews_enabled,sponsored_drawer,frequently_bought_together,"
        "show_ynp_opt_in_ui_elements,show_ynp_add_to_basket_toast,show_ynp_card,"
        "similar_products_drawer,fetch_ynp_opt_ins,resting_search_v2,bop_enabled,"
        "identity_transfer,prop_bar,favourites_boards,slot_confirmation_board,mobile_nav_2,"
        "highlight_seasonal_nav_item,should_not_scroll_into_view_fbt,show_popular_categories,"
        "compact_reviews,track_remove_scroll_experiment,favourites_grouped_by_top_category,"
        "track_boards_experiment,ynpoptin_national_launch,favourites_link_on_global_header,"
        "hey_sainsburys,heys_resting_state,krang_newness,show_tpr_straplines,"
        "track_compact_tile_experiment,use_compact_tile_boards,use_compact_tile_previous_orders,"
        "use_compact_tile,occasions_closure_end_date_2025,favourites_view_all_AB_test,"
        "retry_your_payments,offers_revamp_2025_rollout,favourites_slot_your_usuals_tracking,"
        "fable_search_bar,hard_sku_replacement,track_occasions_available_from,app_banner,"
        "bigger_images,call_bcs,catchweight_dropdown,citrus_preview_new,citrus_search_trio_banners,"
        "citrus_xsell,compare_seasonal_favourites,constant_commerce_v2,ctt_ynp_products,"
        "desktop_interstitial_variant,disable_product_cache_validation,event_dates,"
        "favourites_pill_nav,favourites_whole_service,favourites_your_usuals_tracking,"
        "fbt_on_search,fbt_on_search_tracking,ff_abc_test_display,first_favourites_static,"
        "foodmaestro_modal,hfss_restricted,interstitial_variant,kg_price_label,"
        "krang_recommendations,lp_ab_test_display,lp_interstitial_grid_config,meal_planner,"
        "meganav,mobile_interstitial_variant,my_nectar_migration,nectar_card_associated,"
        "nectar_prices,new_favourites_filter,new_favourites_service,new_filters,ni_brexit_banner,"
        "occasions,offers_mechanics_carousel,optimised_product_tile,promo_lister_page,"
        "recipes_ingredients_modal,review_syndication,rokt,sale_january,search_cms,"
        "show_hd_xmas_slots_banner,similar_products,slot_v2,xmas_dummy_skus,your_nectar_prices"
    )
    
    # Override default headers for Sainsbury's
    DEFAULT_HEADERS = {
        'Accept': 'application/json',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'content-type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'wcauthtoken': '',
        'Priority': 'u=4',
    }
    
    # Don't retry 500s - they indicate missing cookies for Sainsbury's
    RETRY_STATUS_CODES = [429, 502, 503, 504]
    
    def __init__(self, timeout: int = 30, max_retries: int = 3):
        """Initialize the Sainsbury's service."""
        super().__init__(timeout, max_retries)
        self._cookies_initialized = False
    
    def _generate_span_id(self) -> str:
        """Generate a span ID for request tracing (16 hex chars)."""
        return self._generate_hex_trace_id(16)
    
    def _ensure_cookies(self):
        """
        Ensure the session has the required cookies by visiting the homepage.
        Sainsbury's API requires certain cookies (akaas_gol_random, akavpau_vpc_gol_default)
        to work properly.
        """
        if self._cookies_initialized:
            return
        
        try:
            response = self.session.get(
                'https://www.sainsburys.co.uk/',
                headers={'Accept': 'text/html,*/*'},
                timeout=self.timeout,
            )
            response.raise_for_status()
            self._cookies_initialized = True
            logger.debug(f"Sainsbury's cookies initialized: {len(self.session.cookies)} cookies")
        except requests.RequestException as e:
            logger.warning(f"Failed to initialize Sainsbury's cookies: {e}")
            # Continue anyway - the API might still work
    
    def _get_request_headers(self, query: str) -> dict:
        """
        Get headers for a search request, including dynamic trace headers.
        
        Args:
            query: Search query (used for Referer header)
            
        Returns:
            Dict of headers to use for the request
        """
        trace_id = self._generate_trace_id()
        span_id = self._generate_span_id()
        timestamp = int(time.time() * 1000)
        
        # URL-encode the query for the Referer
        encoded_query = quote(query)
        
        return {
            'Referer': f'https://www.sainsburys.co.uk/gol-ui/SearchResults/{encoded_query}',
            'enabled-feature-flags': self.FEATURE_FLAGS,
            'traceparent': f'00-{trace_id}-{span_id}-01',
            'tracestate': f'2092320@nr=0-1-1782819-181742266-{span_id}----{timestamp}',
        }
    
    def _make_request(self, endpoint: str, params: Optional[dict] = None, extra_headers: Optional[dict] = None) -> dict:
        """
        Make a request to the Sainsbury's API.
        
        Args:
            endpoint: API endpoint path
            params: Query parameters
            extra_headers: Additional headers to include in the request
            
        Returns:
            JSON response as dict
            
        Raises:
            requests.RequestException: On API errors
        """
        url = f"{self.BASE_URL}/{endpoint}"
        
        # Merge extra headers if provided
        headers = extra_headers if extra_headers else {}
        
        try:
            response = self.session.get(
                url,
                params=params,
                headers=headers,
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Sainsbury's API error: {e}")
            raise
    
    def _parse_product(self, data: dict) -> GrocerProduct:
        """
        Parse a product from Sainsbury's API response format.
        
        Args:
            data: Raw product data from API
            
        Returns:
            Standardized GrocerProduct
        """
        # Parse retail price
        retail_price = None
        if 'retail_price' in data:
            rp = data['retail_price']
            retail_price = GrocerPrice(
                price=Decimal(str(rp.get('price', 0))),
                currency='GBP',
                measure=parse_price_measure(rp.get('measure', 'unit')),
            )
        
        # Parse unit price (price per kg/litre/etc)
        unit_price = None
        if 'unit_price' in data:
            up = data['unit_price']
            unit_price = GrocerPrice(
                price=Decimal(str(up.get('price', 0))),
                currency='GBP',
                measure=parse_price_measure(up.get('measure', 'unit')),
            )
        
        # Parse promotions
        promotions = []
        for promo in data.get('promotions', []):
            promotions.append(GrocerPromotion(
                description=promo.get('strap_line', ''),
                original_price=Decimal(str(promo['original_price'])) if promo.get('original_price') else None,
                promo_price=retail_price.price if retail_price else None,
                start_date=promo.get('start_date'),
                end_date=promo.get('end_date'),
            ))
        
        # If there's a promotion, mark the retail price as on sale
        if promotions and retail_price:
            retail_price.is_on_sale = True
            if promotions[0].original_price:
                retail_price.original_price = promotions[0].original_price
        
        # Parse categories
        categories = [cat.get('name', '') for cat in data.get('categories', []) if cat.get('name')]
        
        # Get brand from attributes
        brand = None
        attributes = data.get('attributes', {})
        if 'brand' in attributes and attributes['brand']:
            brand = attributes['brand'][0] if isinstance(attributes['brand'], list) else attributes['brand']

        # Get ingredients from attributes (Sainsbury's includes this in search results)
        ingredients_text = None
        raw_ingredients = attributes.get('ingredients')
        if raw_ingredients:
            if isinstance(raw_ingredients, list):
                ingredients_text = ', '.join(str(i) for i in raw_ingredients if i) or None
            elif isinstance(raw_ingredients, str):
                ingredients_text = raw_ingredients.strip() or None
        
        # Parse reviews
        reviews = data.get('reviews', {})
        rating = reviews.get('average_rating')
        review_count = reviews.get('total')
        
        return GrocerProduct(
            grocer_id=self.GROCER_ID,
            product_id=str(data.get('product_uid', '')),
            name=data.get('name', ''),
            description='',  # Not provided in search results
            brand=brand,
            barcodes=data.get('eans', []),
            retail_price=retail_price,
            unit_price=unit_price,
            is_available=data.get('is_available', True),
            categories=categories,
            image_url=data.get('image'),
            thumbnail_url=data.get('image_thumbnail'),
            promotions=promotions,
            product_url=data.get('full_url'),
            rating=float(rating) if rating else None,
            review_count=int(review_count) if review_count else None,
            ingredients_text=ingredients_text,
            raw_data=data,
        )
    
    def search_products(
        self,
        query: str,
        page: int = 1,
        page_size: int = 20,
    ) -> GrocerSearchResult:
        """
        Search for products on Sainsbury's.
        
        Args:
            query: Search term
            page: Page number (1-indexed)
            page_size: Results per page (max 60)
            
        Returns:
            GrocerSearchResult with matching products
        """
        # Ensure we have the required cookies
        self._ensure_cookies()
        
        # Sainsbury's max page size is 60
        page_size = min(page_size, 60)
        
        # Get dynamic headers for this request
        extra_headers = self._get_request_headers(query)
        
        # Build the URL manually to avoid encoding filter[keyword] brackets
        # Sainsbury's requires: filter[keyword]=orange%20juice (NOT filter%5Bkeyword%5D)
        encoded_query = quote(query, safe='')  # Encode spaces as %20, not +
        url = (
            f"{self.BASE_URL}/product"
            f"?filter[keyword]={encoded_query}"
            f"&citrus_max_number_ads=5"
            f"&page_number={page}"
            f"&page_size={page_size}"
            f"&sort_order=FAVOURITES_FIRST"
            f"&salesWindow=1"
        )
        
        try:
            # Use a PreparedRequest to prevent requests from re-encoding the URL
            req = requests.Request('GET', url, headers=extra_headers)
            prepared = self.session.prepare_request(req)
            # Override the URL to prevent double-encoding of brackets
            prepared.url = url
            
            response = self.session.send(prepared, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            logger.error(f"Sainsbury's search error: {e}")
            # Return empty result on error
            return GrocerSearchResult(
                products=[],
                total_count=0,
                page=page,
                page_size=page_size,
                has_more=False,
            )
        
        # Parse products
        products = []
        for item in data.get('products', []):
            try:
                product = self._parse_product(item)
                products.append(product)
            except Exception as e:
                logger.warning(f"Failed to parse product: {e}")
                continue
        
        # Get pagination info from controls
        controls = data.get('controls', {})
        total_count = controls.get('total_record_count', len(products))
        page_info = controls.get('page', {})
        current_page = page_info.get('active', page)
        last_page = page_info.get('last', 1)
        
        return GrocerSearchResult(
            products=products,
            total_count=total_count,
            page=current_page,
            page_size=page_size,
            has_more=current_page < last_page,
        )
    
    def get_product_by_id(self, product_id: str) -> Optional[GrocerProduct]:
        """
        Get a specific product by its Sainsbury's product UID.
        
        Note: Sainsbury's doesn't have a direct product lookup endpoint,
        so this searches for the product ID.
        
        Args:
            product_id: Sainsbury's product_uid
            
        Returns:
            GrocerProduct if found, None otherwise
        """
        # Try searching for the product ID
        result = self.search_products(product_id, page_size=10)
        
        for product in result.products:
            if product.product_id == product_id:
                return product
        
        return None
    
    def get_product_by_barcode(self, barcode: str) -> Optional[GrocerProduct]:
        """
        Get a product by its barcode/EAN.
        
        Args:
            barcode: EAN/UPC barcode
            
        Returns:
            GrocerProduct if found, None otherwise
        """
        # Search for the barcode
        result = self.search_products(barcode, page_size=20)

        for product in result.products:
            # Check if any of the product's barcodes match
            for ean in product.barcodes:
                if _barcode_matches(ean, barcode):
                    return product

        return None
