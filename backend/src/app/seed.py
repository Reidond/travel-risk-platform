"""First-startup seeding: default criteria, platform config v1, ruleset v1.

Ukrainian criterion texts are taken verbatim from the article (section M_I);
English texts are faithful translations.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.core_bridge import default_params, default_rules_payload

DEFAULT_CRITERIA: list[dict[str, object]] = [
    {
        "code": "G1",
        "name_uk": "Безпека інфраструктури місця відвідування",
        "name_en": "Infrastructure safety of the visited place",
        "criteria": [
            (
                "K11",
                "Інформація, розміщена на інформаційних табличках, була для мене "
                "недостатньо зрозумілою або нечіткою",
                "The information displayed on information signs was insufficiently "
                "clear or ambiguous to me",
            ),
            (
                "K12",
                "На мою думку, у регіоні бракує інфраструктури або органів, які "
                "здійснюють контроль за безпекою туристів",
                "In my opinion, the region lacks infrastructure or authorities that "
                "oversee tourist safety",
            ),
            (
                "K13",
                "Відчував занепокоєння через хаотичний дорожній рух і можливі ризики "
                "для безпеки на дорогах",
                "I felt concerned about chaotic road traffic and possible road safety risks",
            ),
            (
                "K14",
                "Був занепокоєний рівнем безпеки житла або помешкання, в якому "
                "перебував під час подорожі",
                "I was concerned about the safety of the housing or accommodation "
                "I stayed in during the trip",
            ),
            (
                "K15",
                "Під час поїздки автомобілем я відчував страх або тривогу щодо "
                "можливості дорожньо-транспортної пригоди",
                "While travelling by car, I felt fear or anxiety about the "
                "possibility of a road traffic accident",
            ),
        ],
    },
    {
        "code": "G2",
        "name_uk": "Соціальна та екологічна безпека туризму",
        "name_en": "Social and ecological safety of tourism",
        "criteria": [
            (
                "K21",
                "Відчував занепокоєння через серйозне екологічне забруднення у туристичному місці",
                "I felt concerned about serious environmental pollution at the tourist destination",
            ),
            (
                "K22",
                "Через побоювання пограбування з боку місцевих торговців я надавав "
                "перевагу покупкам у супермаркетах або спеціалізованих магазинах",
                "Fearing being overcharged or robbed by local traders, I preferred "
                "shopping in supermarkets or specialised stores",
            ),
            (
                "K23",
                "Відчував страх або дискомфорт через велику кількість людей у "
                "популярних туристичних локаціях",
                "I felt fear or discomfort because of large crowds at popular tourist locations",
            ),
            (
                "K24",
                "Мене непокоїло недружнє або зневажливе ставлення місцевих працівників до туристів",
                "I was troubled by unfriendly or dismissive attitudes of local "
                "staff towards tourists",
            ),
            (
                "K25",
                "Відчував тривогу через вороже або неприязне ставлення місцевого "
                "населення до туристів",
                "I felt anxious because of hostile or unfriendly attitudes of the "
                "local population towards tourists",
            ),
            (
                "K26",
                "Переймався через можливість випадкового порушення місцевих "
                "традицій, культурних норм або неписаних правил",
                "I worried about accidentally violating local traditions, cultural "
                "norms or unwritten rules",
            ),
            (
                "K27",
                "Був стурбований тим, що місцеві жителі неохоче приймають туристів у свої громади",
                "I was concerned that local residents are reluctant to welcome "
                "tourists into their communities",
            ),
        ],
    },
    {
        "code": "G3",
        "name_uk": "Медична безпека туристичної подорожі",
        "name_en": "Medical safety of the tourist trip",
        "criteria": [
            (
                "K31",
                "Переймався станом інфраструктури, оскільки вона могла становити "
                "ризик для мого здоров’я",
                "I worried about the condition of the infrastructure, as it could "
                "pose a risk to my health",
            ),
            (
                "K32",
                "Відчував небезпеку для здоров’я, яку могло спричинити навколишнє "
                "природне середовище",
                "I sensed health hazards that could be caused by the natural environment",
            ),
            (
                "K33",
                "Хвилювався через ймовірність захворювання на вірусні інфекції під час подорожі",
                "I worried about the likelihood of contracting viral infections during the trip",
            ),
            (
                "K34",
                "Мене турбувала загроза здоров’ю під час перебування у місці призначення",
                "I was troubled by threats to my health while staying at the destination",
            ),
            (
                "K35",
                "Відчував занепокоєння щодо якості та безпечності місцевих продуктів харчування",
                "I felt concerned about the quality and safety of local food products",
            ),
        ],
    },
]


def seed_defaults(session: Session) -> None:
    """Idempotently seed criteria, config v1 and ruleset v1 on first startup."""
    if session.scalars(select(models.CriteriaGroup)).first() is None:
        for group_pos, group_spec in enumerate(DEFAULT_CRITERIA):
            group = models.CriteriaGroup(
                code=str(group_spec["code"]),
                name_uk=str(group_spec["name_uk"]),
                name_en=str(group_spec["name_en"]),
                position=group_pos,
            )
            criteria: list[tuple[str, str, str]] = group_spec["criteria"]  # type: ignore[assignment]
            for crit_pos, (code, text_uk, text_en) in enumerate(criteria):
                group.criteria.append(
                    models.Criterion(
                        code=code,
                        text_uk=text_uk,
                        text_en=text_en,
                        position=crit_pos,
                    )
                )
            session.add(group)

    if session.scalars(select(models.PlatformConfig)).first() is None:
        session.add(
            models.PlatformConfig(
                version=1,
                active=True,
                comment="Article preset (core DEFAULT_CONFIG)",
                params=default_params(),
            )
        )

    if session.scalars(select(models.RuleSetVersion)).first() is None:
        rules, default_output = default_rules_payload()
        session.add(
            models.RuleSetVersion(
                version=1,
                active=True,
                comment="Article preset (core DEFAULT_RULES)",
                rules=rules,
                default_output=default_output,
            )
        )

    session.commit()
