from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status

from products.models import NewsArticle


class NewsArticleModelTest(TestCase):
    def test_create_article(self):
        article = NewsArticle.objects.create(
            title='Budget Shopping Tips',
            excerpt='Learn how to save money on groceries.',
        )
        self.assertEqual(str(article), 'Budget Shopping Tips')
        self.assertTrue(article.is_published)
        self.assertEqual(article.read_time_minutes, 3)
        self.assertEqual(article.icon_name, 'newspaper-outline')
        self.assertEqual(article.icon_color, 'primary')
        self.assertEqual(article.category, 'General')

    def test_unpublished_article(self):
        article = NewsArticle.objects.create(
            title='Draft Article',
            excerpt='Not published yet.',
            is_published=False,
        )
        self.assertFalse(article.is_published)

    def test_ordering_newest_first(self):
        a1 = NewsArticle.objects.create(title='First', excerpt='e1')
        a2 = NewsArticle.objects.create(title='Second', excerpt='e2')
        articles = list(NewsArticle.objects.all())
        self.assertEqual(articles[0], a2)
        self.assertEqual(articles[1], a1)

    def test_custom_fields(self):
        article = NewsArticle.objects.create(
            title='Health Guide',
            excerpt='Nutrition tips.',
            icon_name='heart-outline',
            icon_color='teal',
            read_time_minutes=5,
            category='Health',
        )
        self.assertEqual(article.icon_color, 'teal')
        self.assertEqual(article.read_time_minutes, 5)
        self.assertEqual(article.category, 'Health')


class NewsArticleAPITest(APITestCase):
    def setUp(self):
        NewsArticle.objects.create(title='Published', excerpt='pub', is_published=True)
        NewsArticle.objects.create(title='Draft', excerpt='draft', is_published=False)

    def test_list_articles(self):
        response = self.client.get('/api/news/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_returns_published_only(self):
        response = self.client.get('/api/news/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        titles = [a['title'] for a in results]
        self.assertIn('Published', titles)
        self.assertNotIn('Draft', titles)
