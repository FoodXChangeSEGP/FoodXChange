from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def create_default_lists_and_assign(apps, schema_editor):
    """
    For each user that has MyListItem records, create a default 'My List'
    UserList and assign all their items to it.
    """
    MyListItem = apps.get_model('products', 'MyListItem')
    UserList = apps.get_model('products', 'UserList')

    user_ids = (
        MyListItem.objects
        .exclude(user_id=None)
        .values_list('user_id', flat=True)
        .distinct()
    )

    for user_id in user_ids:
        user_list = UserList.objects.create(user_id=user_id, name='My List')
        MyListItem.objects.filter(user_id=user_id).update(user_list=user_list)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('products', '0005_mylistitem_user_alter_mylistitem_unique_together_and_more'),
    ]

    operations = [
        # 1. Create the UserList table
        migrations.CreateModel(
            name='UserList',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='My List', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='user_lists',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['created_at']},
        ),

        # 2. Add nullable user_list FK to MyListItem
        migrations.AddField(
            model_name='mylistitem',
            name='user_list',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='items',
                to='products.userlist',
            ),
        ),

        # 3. Data migration: create default lists and assign items
        migrations.RunPython(
            create_default_lists_and_assign,
            migrations.RunPython.noop,
        ),

        # 4. Make user_list non-nullable
        migrations.AlterField(
            model_name='mylistitem',
            name='user_list',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='items',
                to='products.userlist',
            ),
        ),

        # 5. Remove old unique_together (user, barcode)
        migrations.AlterUniqueTogether(
            name='mylistitem',
            unique_together=set(),
        ),

        # 6. Remove old user FK from MyListItem
        migrations.RemoveField(
            model_name='mylistitem',
            name='user',
        ),

        # 7. Add new unique_together (user_list, barcode)
        migrations.AlterUniqueTogether(
            name='mylistitem',
            unique_together={('user_list', 'barcode')},
        ),
    ]
