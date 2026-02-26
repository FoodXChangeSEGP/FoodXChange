from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CommunityGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('description', models.TextField()),
                ('category', models.CharField(
                    choices=[
                        ('food', 'Food & Nutrition'),
                        ('budget', 'Budget & Savings'),
                        ('local', 'Local Community'),
                        ('health', 'Health & Wellness'),
                        ('recipes', 'Recipes & Cooking'),
                        ('general', 'General'),
                    ],
                    default='general', max_length=50,
                )),
                ('is_featured', models.BooleanField(default=False)),
                ('is_trending', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_groups',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='Topic',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('body', models.TextField()),
                ('is_deleted', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('group', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='topics',
                    to='community.communitygroup',
                )),
                ('created_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='topics',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='Comment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('body', models.TextField()),
                ('is_deleted', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('topic', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='comments',
                    to='community.topic',
                )),
                ('parent', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='replies',
                    to='community.comment',
                )),
                ('created_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='community_comments',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['created_at']},
        ),
        migrations.CreateModel(
            name='GroupMembership',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(
                    choices=[('member', 'Member'), ('admin', 'Admin')],
                    default='member', max_length=20,
                )),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='group_memberships',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('group', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='memberships',
                    to='community.communitygroup',
                )),
            ],
            options={'ordering': ['-joined_at'], 'unique_together': {('user', 'group')}},
        ),
        migrations.CreateModel(
            name='TopicVote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('vote_type', models.CharField(
                    choices=[('useful', 'Useful'), ('not_useful', 'Not Useful'), ('flag', 'Flag')],
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='topic_votes',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('topic', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='votes',
                    to='community.topic',
                )),
            ],
            options={'unique_together': {('user', 'topic')}},
        ),
        migrations.CreateModel(
            name='CommentVote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('vote_type', models.CharField(
                    choices=[('useful', 'Useful'), ('not_useful', 'Not Useful'), ('flag', 'Flag')],
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='comment_votes',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('comment', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='votes',
                    to='community.comment',
                )),
            ],
            options={'unique_together': {('user', 'comment')}},
        ),
    ]
