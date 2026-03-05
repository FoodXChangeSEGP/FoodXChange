from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('community', '0003_conversation_directmessage_friendship_friendrequest'),
    ]

    operations = [
        migrations.AddField(
            model_name='foodxevent',
            name='linked_groups',
            field=models.ManyToManyField(
                blank=True,
                related_name='linked_events',
                to='community.communitygroup',
            ),
        ),
    ]
