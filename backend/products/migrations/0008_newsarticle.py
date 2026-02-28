from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0007_offproduct_ingredients_text'),
    ]

    operations = [
        migrations.CreateModel(
            name='NewsArticle',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('excerpt', models.TextField()),
                ('content', models.TextField(blank=True)),
                ('icon_name', models.CharField(default='newspaper-outline', max_length=100)),
                ('icon_color', models.CharField(
                    default='primary',
                    help_text='Color key: primary, lime, orange, teal',
                    max_length=20,
                )),
                ('read_time_minutes', models.PositiveSmallIntegerField(default=3)),
                ('category', models.CharField(default='General', max_length=100)),
                ('is_published', models.BooleanField(default=True)),
                ('published_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-published_at'],
            },
        ),
    ]
