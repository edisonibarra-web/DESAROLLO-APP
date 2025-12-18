from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """
    Filtro para obtener un valor de un diccionario por su clave.
    Uso en template: {{ mi_dict|get_item:mi_key }}
    """
    if dictionary:
        return dictionary.get(key)
    return None

@register.filter
def get_val(dictionary, key):
    """Alias de get_item para brevedad"""
    if dictionary:
        return dictionary.get(key, "")
    return ""

