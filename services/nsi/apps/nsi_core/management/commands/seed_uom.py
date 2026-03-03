from django.core.management.base import BaseCommand
from apps.nsi_core.models import UoMCategory, UoM

class Command(BaseCommand):
    help = "Seed base UoM categories and UoMs"

    def handle(self, *args, **kwargs):
        cats = {
            "MASS": "Масса",
            "VOLUME": "Объём",
            "LENGTH": "Длина",
            "COUNT": "Количество",
        }
        cat_objs = {}
        for code, name in cats.items():
            obj, _ = UoMCategory.objects.get_or_create(code=code, defaults={"name": name})
            cat_objs[code] = obj

        # базовые UoM (можно расширять)
        uoms = [
            ("KG", "Килограмм", "MASS", "1", 3),
            ("TON", "Тонна", "MASS", "1000", 3),
            ("G", "Грамм", "MASS", "0.001", 3),

            ("L", "Литр", "VOLUME", "1", 3),
            ("ML", "Миллилитр", "VOLUME", "0.001", 3),

            ("M", "Метр", "LENGTH", "1", 3),
            ("CM", "Сантиметр", "LENGTH", "0.01", 3),

            ("PCS", "Штука", "COUNT", "1", 0),
            ("BAG", "Мешок", "COUNT", "1", 0),
            ("CAN", "Банка", "COUNT", "1", 0),
            ("BOX", "Ящик", "COUNT", "1", 0),
        ]

        for code, name, cat, factor, precision in uoms:
            UoM.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "category": cat_objs[cat],
                    "factor_to_base": factor,
                    "precision": precision,
                },
            )

        self.stdout.write(self.style.SUCCESS("Seeded UoM categories and UoMs"))