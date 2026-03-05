from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('community', '0004_foodxevent_linked_groups'),
    ]

    operations = [
        migrations.AddField(
            model_name='directmessage',
            name='shared_list_data',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='directmessage',
            name='text',
            field=models.TextField(blank=True),
        ),
    ]
