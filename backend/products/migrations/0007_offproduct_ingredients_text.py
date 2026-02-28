from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0006_userlist_mylistitem_refactor'),
    ]

    operations = [
        migrations.AddField(
            model_name='offproduct',
            name='ingredients_text',
            field=models.TextField(blank=True, default='', help_text='Ingredients list from Open Food Facts'),
        ),
    ]
