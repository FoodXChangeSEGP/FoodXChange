from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('community', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='FoodXEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField()),
                ('long_description', models.TextField(blank=True)),
                ('location_name', models.CharField(max_length=200)),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
                ('date', models.DateField()),
                ('event_time', models.CharField(blank=True, max_length=50)),
                ('category', models.CharField(
                    choices=[
                        ('market', 'Food Market'),
                        ('swap', 'Food Swap'),
                        ('workshop', 'Workshop'),
                        ('tasting', 'Tasting'),
                        ('festival', 'Food Festival'),
                        ('community', 'Community Meal'),
                        ('other', 'Other'),
                    ],
                    default='other',
                    max_length=50,
                )),
                ('image_url', models.URLField(blank=True, max_length=500)),
                ('organizer', models.CharField(blank=True, max_length=200)),
                ('price', models.CharField(default='Free', max_length=100)),
                ('attendee_count', models.PositiveIntegerField(default=0)),
                ('tags', models.JSONField(blank=True, default=list)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['date'],
            },
        ),
    ]
