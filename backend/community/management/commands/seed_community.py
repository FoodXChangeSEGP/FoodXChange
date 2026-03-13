"""
Management command to seed community data:
- FoodX events across London (for the map)
- Community groups with topics and comments
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from community.models import FoodXEvent, CommunityGroup, GroupMembership, Topic, Comment

User = get_user_model()

EVENTS = [
    {
        'title': 'Borough Market Fresh Produce Festival',
        'description': 'A celebration of seasonal, locally-sourced produce at one of London\'s oldest food markets.',
        'long_description': (
            'Join us for a weekend of fresh, locally-sourced food at Borough Market. '
            'Discover over 100 stalls showcasing the best of British produce — from artisan cheeses '
            'and freshly baked breads to seasonal vegetables and sustainably caught fish. '
            'Live cooking demonstrations, tastings, and talks on food sustainability run throughout the day. '
            'Perfect for families, foodies, and anyone looking to shop smarter and eat healthier.'
        ),
        'location_name': 'Borough Market, Southwark, London',
        'latitude': 51.5055,
        'longitude': -0.0906,
        'date': '2026-04-12',
        'event_time': '10:00 AM – 6:00 PM',
        'category': 'festival',
        'organizer': 'Borough Market Trust',
        'price': 'Free entry',
        'attendee_count': 3500,
        'tags': ['market', 'local-produce', 'sustainable', 'family-friendly'],
    },
    {
        'title': 'Hackney Community Food Swap',
        'description': 'Bring surplus food from your kitchen or garden and swap with neighbours.',
        'long_description': (
            'Got too many courgettes from the allotment? Baked one too many loaves? '
            'The Hackney Community Food Swap is a friendly, informal event where locals '
            'bring surplus food — homegrown veg, home-baked goods, sealed pantry staples — '
            'and exchange with others. Zero waste, zero cost, maximum community spirit. '
            'All welcome. No food will be wasted — anything unclaimed is donated to the local food bank.'
        ),
        'location_name': 'Hackney Town Hall, Mare Street, London E8',
        'latitude': 51.5449,
        'longitude': -0.0553,
        'date': '2026-04-19',
        'event_time': '11:00 AM – 2:00 PM',
        'category': 'swap',
        'organizer': 'Hackney Food Network',
        'price': 'Free',
        'attendee_count': 120,
        'tags': ['zero-waste', 'community', 'swap', 'hackney'],
    },
    {
        'title': 'East London Budget Cooking Workshop',
        'description': 'Learn to cook nutritious, delicious meals for under £1.50 per portion.',
        'long_description': (
            'A hands-on cooking workshop focused on making the most of affordable ingredients. '
            'Our chef will guide you through three complete meals — breakfast, lunch, and dinner — '
            'all costed at under £1.50 per serving. Learn about batch cooking, smart shopping, '
            'and how to read nutrition labels to compare value across supermarkets. '
            'Suitable for all skill levels. Ingredients and equipment provided. '
            'Take home a recipe booklet and a bag of seasonal staples.'
        ),
        'location_name': 'Bethnal Green Working Men\'s Club, London E2',
        'latitude': 51.5272,
        'longitude': -0.0590,
        'date': '2026-04-26',
        'event_time': '2:00 PM – 5:00 PM',
        'category': 'workshop',
        'organizer': 'FoodXChange Community',
        'price': '£5 (concessions available)',
        'attendee_count': 40,
        'tags': ['budget-cooking', 'nutrition', 'workshop', 'east-london'],
    },
    {
        'title': 'Brixton Organic Farmers Market',
        'description': 'Weekly farmers market featuring certified organic produce from local farms.',
        'long_description': (
            'Every Saturday, Brixton comes alive with the sights, smells, and flavours of local organic farming. '
            'This weekly market brings together 30+ certified organic producers from within 100 miles of London. '
            'Find seasonal fruit and veg, pasture-raised meats, raw honey, cold-pressed juices, and much more. '
            'Many stall holders offer tastings — it\'s a great way to try before you buy. '
            'The market also features a community noticeboard and a skill-share corner.'
        ),
        'location_name': 'Brixton Village Market, Coldharbour Lane, SW9',
        'latitude': 51.4627,
        'longitude': -0.1145,
        'date': '2026-04-05',
        'event_time': '9:00 AM – 2:00 PM',
        'category': 'market',
        'organizer': 'Brixton Organic Collective',
        'price': 'Free entry',
        'attendee_count': 800,
        'tags': ['organic', 'farmers-market', 'brixton', 'sustainable'],
    },
    {
        'title': 'Notting Hill Wine & Cheese Tasting',
        'description': 'An evening of guided wine and artisan cheese pairings from independent producers.',
        'long_description': (
            'Join our expert sommelier and cheesemonger for an intimate tasting evening in the heart of Notting Hill. '
            'You\'ll sample six wines paired with six carefully selected artisan cheeses, learning about flavour profiles, '
            'terroir, and the art of pairing. All wines come from small independent producers, and cheeses are sourced '
            'from British and European farmhouses. Tickets include all tastings, a take-home tasting notes card, '
            'and 10% off at our partner cheese shop.'
        ),
        'location_name': 'Portobello Road, Notting Hill, W11',
        'latitude': 51.5121,
        'longitude': -0.2000,
        'date': '2026-05-02',
        'event_time': '7:00 PM – 9:30 PM',
        'category': 'tasting',
        'organizer': 'Portobello Food Society',
        'price': '£25 per person',
        'attendee_count': 30,
        'tags': ['wine', 'cheese', 'tasting', 'notting-hill'],
    },
    {
        'title': 'Walthamstow Community Kitchen Supper Club',
        'description': 'A monthly communal meal cooked and shared by local residents.',
        'long_description': (
            'Our monthly supper club is at the heart of what FoodX Community is all about — '
            'bringing people together over great food. Volunteers from the neighbourhood prepare a '
            'three-course meal using rescued and surplus food from local supermarkets and producers. '
            'Nothing goes to waste, and every plate tells a story. '
            'Pay-what-you-can entry means everyone is welcome regardless of budget. '
            'Come alone or bring the family — you\'re guaranteed to leave with a full belly and new friends.'
        ),
        'location_name': 'Walthamstow Social Club, E17',
        'latitude': 51.5876,
        'longitude': -0.0183,
        'date': '2026-04-18',
        'event_time': '6:30 PM – 9:00 PM',
        'category': 'community',
        'organizer': 'Walthamstow Food Community',
        'price': 'Pay what you can',
        'attendee_count': 60,
        'tags': ['supper-club', 'community-meal', 'surplus-food', 'walthamstow'],
    },
    {
        'title': 'Peckham Street Food & Culture Festival',
        'description': 'A two-day celebration of Peckham\'s diverse food scene and multicultural heritage.',
        'long_description': (
            'Peckham is one of London\'s most vibrant and diverse neighbourhoods, '
            'and this festival celebrates everything that makes it special. '
            'Over 50 street food traders, live music, cultural performances, and workshops on African, '
            'Caribbean, and South East Asian cuisines. Learn to make jollof rice, jerk chicken, or pho '
            'from people who\'ve been cooking these dishes their whole lives. '
            'A portion of all proceeds supports local food poverty charities.'
        ),
        'location_name': 'Peckham Rye Park, SE15',
        'latitude': 51.4746,
        'longitude': -0.0683,
        'date': '2026-05-10',
        'event_time': '12:00 PM – 9:00 PM',
        'category': 'festival',
        'organizer': 'Peckham Traders Association',
        'price': 'Free entry (food & drink extra)',
        'attendee_count': 4000,
        'tags': ['street-food', 'multicultural', 'festival', 'peckham'],
    },
    {
        'title': 'Islington Nutrition & Label Reading Workshop',
        'description': 'Understand NOVA scores, Nutri-Score, and how to compare products in-store.',
        'long_description': (
            'Are you confused by food labels? Do you want to understand what NOVA scores and Nutri-Score '
            'really mean for your health? This practical workshop, run by a registered dietitian, '
            'will walk you through everything you need to know. You\'ll practice reading labels on real products, '
            'learn which marketing claims to trust, and discover how to use apps like FoodXChange '
            'to make healthier, more affordable choices. '
            'Free to attend. Light refreshments provided.'
        ),
        'location_name': 'Islington Central Library, N1',
        'latitude': 51.5382,
        'longitude': -0.1030,
        'date': '2026-04-23',
        'event_time': '10:30 AM – 12:30 PM',
        'category': 'workshop',
        'organizer': 'Islington Healthy Living Initiative',
        'price': 'Free',
        'attendee_count': 35,
        'tags': ['nutrition', 'food-labels', 'nutri-score', 'nova', 'health'],
    },
    {
        'title': 'Greenwich Riverside Food Market',
        'description': 'Artisan food market along the Thames with views of the Cutty Sark.',
        'long_description': (
            'Every weekend, the riverside at Greenwich transforms into a foodie paradise. '
            'Browse stalls selling handmade pasta, freshly smoked meats, vegan street food, '
            'home-made preserves, and craft beers from London\'s finest microbreweries. '
            'The market is dog-friendly and has seating areas along the water\'s edge. '
            'Keep an eye out for the foraging workshop that runs on the first Sunday of each month — '
            'guided by an expert botanist, you\'ll learn to identify edible plants in the park nearby.'
        ),
        'location_name': 'Greenwich Pier, King William Walk, SE10',
        'latitude': 51.4826,
        'longitude': -0.0077,
        'date': '2026-04-06',
        'event_time': '10:00 AM – 4:00 PM',
        'category': 'market',
        'organizer': 'Greenwich Markets',
        'price': 'Free entry',
        'attendee_count': 1200,
        'tags': ['artisan', 'riverside', 'market', 'greenwich'],
    },
    {
        'title': 'Camden Food Lovers Festival',
        'description': 'Three days of food, music, and culture in the heart of Camden.',
        'long_description': (
            'Camden\'s legendary food scene gets the festival treatment for three days of non-stop eating, '
            'drinking, and entertainment. Over 80 food traders, a dedicated vegan village, '
            'a craft beer garden, chef battle competitions on the main stage, and family-friendly '
            'activities including messy cooking for kids. The festival showcases cuisines from '
            'around the world, with a particular focus on London\'s immigrant food heritage. '
            'Highlights include a sustainable food debate, a zero-waste cooking challenge, '
            'and a late-night street food session on Saturday.'
        ),
        'location_name': 'Regent\'s Canal, Camden, NW1',
        'latitude': 51.5396,
        'longitude': -0.1426,
        'date': '2026-05-23',
        'event_time': '11:00 AM – 10:00 PM',
        'category': 'festival',
        'organizer': 'Camden Council & Camden Market',
        'price': 'Free entry',
        'attendee_count': 8000,
        'tags': ['festival', 'camden', 'street-food', 'vegan', 'music'],
    },
    {
        'title': 'Battersea Budget Meal Prep Masterclass',
        'description': 'Master the art of weekly meal prep to save money and eat healthier.',
        'long_description': (
            'Spending too much on food? Struggling to eat well on a tight budget? '
            'This hands-on masterclass teaches you a complete weekly meal prep system. '
            'You\'ll leave knowing how to plan five days of breakfasts, lunches, and dinners '
            'for around £25 per person, how to store food safely to minimise waste, '
            'and how to use the FoodXChange app to identify the best-value products across '
            'Tesco and Sainsbury\'s. All cooking equipment and ingredients are provided. '
            'Groups are kept small (max 12 people) to ensure individual attention.'
        ),
        'location_name': 'Battersea Arts Centre, SW11',
        'latitude': 51.4717,
        'longitude': -0.1549,
        'date': '2026-05-07',
        'event_time': '10:00 AM – 1:00 PM',
        'category': 'workshop',
        'organizer': 'FoodXChange Community',
        'price': '£8',
        'attendee_count': 12,
        'tags': ['meal-prep', 'budget', 'cooking', 'battersea'],
    },
    {
        'title': 'Stratford Multicultural Food Fair',
        'description': 'A celebration of East London\'s incredible culinary diversity.',
        'long_description': (
            'East London is home to communities from over 100 countries, and this fair brings their '
            'food traditions together under one roof. Sample dishes from West Africa, South Asia, '
            'the Middle East, the Caribbean, Eastern Europe, and beyond. '
            'Every dish is cooked by community members using family recipes passed down through generations. '
            'The fair also includes a "cook-along" stage where you can learn to prepare dishes in real time, '
            'a children\'s area with food-themed crafts, and a panel discussion on the role of food in building community.'
        ),
        'location_name': 'Westfield Stratford City Outdoor Plaza, E20',
        'latitude': 51.5430,
        'longitude': -0.0012,
        'date': '2026-06-07',
        'event_time': '11:00 AM – 7:00 PM',
        'category': 'festival',
        'organizer': 'Newham Community Trust',
        'price': 'Free entry',
        'attendee_count': 2500,
        'tags': ['multicultural', 'east-london', 'food-fair', 'community'],
    },
]

GROUPS = [
    {
        'name': 'Budget Savvy Shoppers',
        'description': 'Tips, tricks, and strategies for feeding a family on a tight budget. Share your deals and savings wins!',
        'category': 'budget',
        'is_featured': True,
        'is_trending': True,
        'topics': [
            {
                'title': 'Best value protein sources right now?',
                'body': (
                    'I\'ve been comparing protein per penny across Tesco and Sainsbury\'s. '
                    'Eggs are still unbeatable at around 8p each but curious what others are finding. '
                    'Tinned sardines are another great one — loads of omega-3, cheap, and long shelf life.'
                ),
                'comments': [
                    'Tinned lentils! 400g can has loads of protein and costs about 55p at Tesco.',
                    'Greek yoghurt in the big 1kg tub from Sainsbury\'s own-brand is brilliant value. Protein and probiotics.',
                    'Frozen edamame from the freezer aisle — great in stir fries and really filling.',
                ],
            },
            {
                'title': 'Tesco Clubcard vs Sainsbury\'s Nectar — which gives better value?',
                'body': (
                    'I\'ve been trying to figure out whether it\'s worth switching my main shop. '
                    'Tesco Clubcard prices are often significantly lower on everyday items, '
                    'but Sainsbury\'s sometimes has better multi-buy deals. What\'s your experience?'
                ),
                'comments': [
                    'Tesco wins for me on the weekly staples. Their Clubcard prices on bread and milk are consistently lower.',
                    'Nectar is better if you use it with Argos too — double points on some purchases.',
                ],
            },
            {
                'title': 'Share your weekly shop budget!',
                'body': (
                    'Trying to get a sense of what others are spending. '
                    'I\'m a single person and manage £30/week including all meals. '
                    'What about families? Would love to know what\'s realistic for different household sizes.'
                ),
                'comments': [
                    'Family of 4, we do £80/week and that includes a couple of nice treats.',
                    'Student here — £20/week if I\'m strict about it. Porridge, pasta, eggs, frozen veg.',
                    'Me and my partner do £50 and eat really well. Batch cooking on Sunday is the key.',
                ],
            },
        ],
    },
    {
        'name': 'London Foodies',
        'description': 'For passionate food lovers in London — restaurant tips, recipe inspiration, ingredient spotlights, and more.',
        'category': 'food',
        'is_featured': True,
        'is_trending': False,
        'topics': [
            {
                'title': 'Best independent food markets in London?',
                'body': (
                    'Borough Market gets all the attention but I\'ve been exploring smaller neighbourhood markets. '
                    'Maltby Street is fantastic on Saturdays — smaller, less touristy, brilliant producers. '
                    'What are your hidden gem markets?'
                ),
                'comments': [
                    'Brockley Market on Saturday mornings is incredible. Really strong artisan bread game.',
                    'Walthamstow Market is the longest outdoor market in Europe — great for fresh produce at excellent prices.',
                    'Queen\'s Market in Upton Park for amazing value on tropical fruit and veg.',
                ],
            },
            {
                'title': 'Seasonal eating — what\'s good in spring?',
                'body': (
                    'Trying to get better at eating seasonally. '
                    'Spring greens, asparagus, and radishes are all starting to appear. '
                    'What are you cooking with at the moment and where are you buying from?'
                ),
                'comments': [
                    'Jersey Royals are just hitting the market — worth every penny. Boiled with butter and mint.',
                    'Wild garlic season is short — grab some from a farmers market and make pesto. Incredible.',
                    'Purple sprouting broccoli is still around and it\'s beautiful right now.',
                ],
            },
        ],
    },
    {
        'name': 'Healthy Families Network',
        'description': 'Parents sharing advice on feeding children nutritiously without breaking the bank.',
        'category': 'health',
        'is_featured': False,
        'is_trending': True,
        'topics': [
            {
                'title': 'Getting kids to eat vegetables — what works?',
                'body': (
                    'My 6-year-old has suddenly decided she hates everything green. '
                    'We\'ve tried hiding veg in sauces but she\'s cottoned on. '
                    'Any tips from parents who\'ve been through this stage?'
                ),
                'comments': [
                    'Involve them in cooking! My son is much more likely to eat it if he helped make it.',
                    'We do "rainbow plates" — try to have 5 different colours on the plate. Makes it feel fun.',
                    'Carrot sticks with hummus as an after-school snack worked wonders for us.',
                ],
            },
            {
                'title': 'Understanding Nutri-Score and NOVA for school lunchboxes',
                'body': (
                    'I\'ve been using the FoodXChange app to check Nutri-Score on things I put in my kids\' lunchboxes. '
                    'Surprised how many "healthy" snacks score D or E. '
                    'Is anyone else doing this? Would love to swap ideas for A and B-rated lunchbox items.'
                ),
                'comments': [
                    'Whole fruit always scores well obviously! And plain yoghurt with a drizzle of honey.',
                    'Cheese cubes, cucumber sticks, oatcakes — all solid Nutri-Score performers.',
                ],
            },
        ],
    },
    {
        'name': 'Zero Waste Kitchen',
        'description': 'Reducing food waste one recipe at a time. Share your creative uses for leftovers and near-expiry ingredients.',
        'category': 'recipes',
        'is_featured': True,
        'is_trending': False,
        'topics': [
            {
                'title': 'What do you make with slightly soft tomatoes?',
                'body': (
                    'I always end up with a punnet of tomatoes that are a day past perfect. '
                    'I usually roast them and blend into soup but curious what others do. '
                    'Any unusual ideas?'
                ),
                'comments': [
                    'Slow roast with garlic and olive oil, then freeze in portions. Perfect pasta sauce all winter.',
                    'Make a quick shakshuka! Eggs poached in tomato sauce — dinner sorted in 20 minutes.',
                    'Tomato and bread salad (panzanella) — it\'s actually better with slightly overripe ones.',
                ],
            },
            {
                'title': 'Banana bread variations that actually work',
                'body': (
                    'Everyone makes banana bread but I want to hear about versions beyond the classic. '
                    'I tried a miso caramel version last week that was next level. '
                    'What\'s your best banana bread twist?'
                ),
                'comments': [
                    'Tahini and chocolate chip. The tahini cuts through the sweetness perfectly.',
                    'I add cardamom and orange zest to mine. Really fragrant and different.',
                    'Peanut butter swirl. Kids love it and it adds protein.',
                ],
            },
        ],
    },
    {
        'name': 'East London Eats',
        'description': 'Hyperlocal group for food lovers in east London — Hackney, Tower Hamlets, Newham, Waltham Forest.',
        'category': 'local',
        'is_featured': False,
        'is_trending': True,
        'topics': [
            {
                'title': 'Best bakeries in Hackney?',
                'body': (
                    'I\'ve just moved to Hackney and want to find a proper bakery for fresh bread. '
                    'Not interested in chains — looking for the independent places doing it right. '
                    'Sourdough preferably!'
                ),
                'comments': [
                    'E5 Bakehouse in London Fields is the gold standard. Queue on weekends but worth it.',
                    'The Dusty Knuckle in Dalston does amazing bread and brilliant sandwiches.',
                    'GAIL\'s is technically a chain but the quality is genuinely good.',
                ],
            },
            {
                'title': 'Favourite cheap eats in Walthamstow?',
                'body': (
                    'Walthamstow doesn\'t get enough credit for its food scene. '
                    'The Market Hall on the High Street has some brilliant stuff. '
                    'What are your go-to spots for an affordable meal?'
                ),
                'comments': [
                    'Eat17 is great — a bit pricier but the burgers are serious.',
                    'All the Turkish and Somali restaurants around St James Street area are incredible value.',
                ],
            },
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed community data: FoodX events, groups, and topics'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing community data first')

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing community data...')
            Comment.objects.all().delete()
            Topic.objects.all().delete()
            GroupMembership.objects.all().delete()
            CommunityGroup.objects.all().delete()
            FoodXEvent.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Cleared.'))

        # Get or create a system user for seeded content
        system_user, _ = User.objects.get_or_create(
            username='foodx_community',
            defaults={'email': 'community@foodxchange.com', 'first_name': 'FoodX', 'last_name': 'Community'},
        )

        # ── Events ──────────────────────────────────────────────────────────
        self.stdout.write('Creating events...')
        event_count = 0
        for ev in EVENTS:
            _, created = FoodXEvent.objects.update_or_create(
                title=ev['title'],
                defaults={**ev, 'is_active': True},
            )
            if created:
                event_count += 1
        self.stdout.write(self.style.SUCCESS(f'  Created/updated {event_count} events.'))

        # ── Groups & Topics ─────────────────────────────────────────────────
        self.stdout.write('Creating groups and topics...')
        group_count = 0
        topic_count = 0
        comment_count = 0

        for gdata in GROUPS:
            topics_data = gdata.pop('topics', [])
            group, created = CommunityGroup.objects.get_or_create(
                name=gdata['name'],
                defaults={**gdata, 'created_by': system_user},
            )
            if created:
                group_count += 1
                # Auto-join the system user as admin
                GroupMembership.objects.get_or_create(
                    user=system_user, group=group,
                    defaults={'role': 'admin'},
                )

            for tdata in topics_data:
                comments_data = tdata.pop('comments', [])
                topic, t_created = Topic.objects.get_or_create(
                    group=group,
                    title=tdata['title'],
                    defaults={**tdata, 'created_by': system_user},
                )
                if t_created:
                    topic_count += 1
                    for body in comments_data:
                        Comment.objects.create(
                            topic=topic,
                            body=body,
                            created_by=system_user,
                        )
                        comment_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'  Created {group_count} groups, {topic_count} topics, {comment_count} comments.'
        ))
        self.stdout.write(self.style.SUCCESS('Community seeding complete!'))
