from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.shortcuts import render
from django.http import HttpResponse
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors
import logging
import re

logger = logging.getLogger(__name__)


from clinico.models import (
    Aseguradora,
    Paciente,
    Formulario,
    Item,
    Parametro,
    FormularioItemParametro,
    CampoParametro,
    Medicion,
    MedicionValor,
)
from clinico.serializers import (
    AseguradoraSerializer,
    PacienteSerializer,
    PacienteListSerializer,
    FormularioSerializer,
    FormularioCreateSerializer,
    ItemSerializer,
    ParametroSerializer,
    CampoParametroSerializer,
    FormularioItemParametroSerializer,
    MedicionSerializer,
    MedicionCreateSerializer,
    MedicionValorSerializer,
)


class AseguradoraViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Aseguradoras
    Permite CRUD completo sobre el modelo Aseguradora
    """
    queryset = Aseguradora.objects.all()
    serializer_class = AseguradoraSerializer
    permission_classes = [AllowAny]
    lookup_field = 'id'


class PacienteViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Pacientes
    Permite CRUD completo sobre el modelo Paciente
    """
    queryset = Paciente.objects.all()
    serializer_class = PacienteSerializer
    permission_classes = [AllowAny]
    lookup_field = 'id'
    
    def get_queryset(self):
        """
        Permite filtrar pacientes por num_identificacion o num_historia_clinica
        Ejemplo: /api/pacientes/?num_identificacion=123456
        """
        queryset = Paciente.objects.all()
        
        num_identificacion = self.request.query_params.get('num_identificacion', None)
        if num_identificacion:
            queryset = queryset.filter(num_identificacion=num_identificacion.strip())
            
        num_historia_clinica = self.request.query_params.get('num_historia_clinica', None)
        if num_historia_clinica:
            queryset = queryset.filter(num_historia_clinica=num_historia_clinica.strip())
            
        return queryset
    
    def get_serializer_class(self):
        """Retorna el serializador apropiado según la acción"""
        # Usamos PacienteSerializer para todo, para asegurar que incluya fecha_nacimiento
        return PacienteSerializer
    
    @action(detail=True, methods=['get'])
    def formularios(self, request, id=None):
        """Obtiene todos los formularios de un paciente"""
        paciente = self.get_object()
        formularios = Formulario.objects.filter(paciente=paciente).select_related('paciente', 'aseguradora')
        serializer = FormularioSerializer(formularios, many=True)
        return Response(serializer.data)


class FormularioViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Formularios
    Permite CRUD completo sobre el modelo Formulario
    """
    queryset = Formulario.objects.select_related('paciente', 'aseguradora').all()
    serializer_class = FormularioSerializer
    permission_classes = [AllowAny]
    lookup_field = 'id'
    
    def get_queryset(self):
        """
        Permite filtrar formularios por num_identificacion del paciente
        Ejemplo: /api/formularios/?paciente__num_identificacion=123456
        """
        queryset = Formulario.objects.select_related('paciente', 'aseguradora').all()
        
        # Filtrar por num_identificacion del paciente
        num_identificacion = self.request.query_params.get('paciente__num_identificacion', None)
        if num_identificacion:
            try:
                # Limpiar el valor del parámetro
                num_identificacion = num_identificacion.strip()
                queryset = queryset.filter(paciente__num_identificacion=num_identificacion)
            except Exception as e:
                logger.error(f"Error al filtrar formularios por num_identificacion '{num_identificacion}': {e}", exc_info=True)
                # Retornar queryset vacío en lugar de lanzar excepción
                return Formulario.objects.none()
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """
        Sobrescribe el método list para manejar errores mejor
        """
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error en list de FormularioViewSet: {e}", exc_info=True)
            return Response(
                {'error': str(e), 'detail': 'Error al obtener formularios'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get_serializer_class(self):
        """Retorna el serializador apropiado según la acción"""
        if self.action in ['create', 'update', 'partial_update']:
            return FormularioCreateSerializer
        return FormularioSerializer
    
    @action(detail=True, methods=['get'])
    def mediciones(self, request, id=None):
        """Obtiene todas las mediciones de un formulario"""
        formulario = self.get_object()
        mediciones = Medicion.objects.filter(formulario=formulario).select_related(
            'formulario', 'parametro'
        ).prefetch_related('valores__campo')
        serializer = MedicionSerializer(mediciones, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def parametros(self, request, id=None):
        """Obtiene todos los parámetros asociados a un formulario"""
        formulario = self.get_object()
        parametros_formulario = FormularioItemParametro.objects.filter(
            formulario=formulario
        ).select_related('formulario', 'item', 'parametro')
        serializer = FormularioItemParametroSerializer(parametros_formulario, many=True)
        return Response(serializer.data)


class ItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Items
    Permite CRUD completo sobre el modelo Item
    """
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    permission_classes = [AllowAny]
    lookup_field = 'id'
    
    @action(detail=True, methods=['get'])
    def parametros(self, request, id=None):
        """Obtiene todos los parámetros de un item"""
        item = self.get_object()
        parametros = Parametro.objects.filter(item=item).select_related('item')
        serializer = ParametroSerializer(parametros, many=True)
        return Response(serializer.data)


class ParametroViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Parámetros
    Permite CRUD completo sobre el modelo Parametro
    """
    queryset = Parametro.objects.select_related('item').all()
    serializer_class = ParametroSerializer
    permission_classes = [AllowAny]
    lookup_field = 'id'
    
    @action(detail=True, methods=['get'])
    def campos(self, request, id=None):
        """Obtiene todos los campos de un parámetro"""
        parametro = self.get_object()
        campos = CampoParametro.objects.filter(parametro=parametro).select_related('parametro')
        serializer = CampoParametroSerializer(campos, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def mediciones(self, request, id=None):
        """Obtiene todas las mediciones de un parámetro"""
        parametro = self.get_object()
        mediciones = Medicion.objects.filter(parametro=parametro).select_related(
            'formulario', 'parametro'
        ).prefetch_related('valores__campo')
        serializer = MedicionSerializer(mediciones, many=True)
        return Response(serializer.data)


class CampoParametroViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Campos de Parámetros
    Permite CRUD completo sobre el modelo CampoParametro
    """
    queryset = CampoParametro.objects.select_related('parametro').all()
    serializer_class = CampoParametroSerializer
    permission_classes = [AllowAny]
    lookup_field = 'id'


class FormularioItemParametroViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar relaciones Formulario-Item-Parámetro
    Permite CRUD completo sobre el modelo FormularioItemParametro
    """
    queryset = FormularioItemParametro.objects.select_related(
        'formulario', 'item', 'parametro'
    ).all()
    serializer_class = FormularioItemParametroSerializer
    permission_classes = [AllowAny]
    lookup_field = 'id'


class MedicionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Mediciones
    Permite CRUD completo sobre el modelo Medicion
    """
    queryset = Medicion.objects.select_related(
        'formulario', 'parametro'
    ).prefetch_related('valores__campo').all()
    serializer_class = MedicionSerializer
    permission_classes = [AllowAny]
    lookup_field = 'id'
    
    def get_serializer_class(self):
        """Retorna el serializador apropiado según la acción"""
        if self.action in ['create', 'update', 'partial_update']:
            return MedicionCreateSerializer
        return MedicionSerializer
    
    @action(detail=True, methods=['get', 'post'])
    def valores(self, request, id=None):
        """Obtiene o crea valores de una medición"""
        medicion = self.get_object()
        
        if request.method == 'GET':
            valores = MedicionValor.objects.filter(medicion=medicion).select_related('medicion', 'campo')
            serializer = MedicionValorSerializer(data=request.data,
            context={'medicion': medicion})

            return Response(serializer.data)
        
        elif request.method == 'POST':
            serializer = MedicionValorSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(medicion=medicion)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MedicionValorViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Valores de Mediciones
    Permite CRUD completo sobre el modelo MedicionValor
    """
    queryset = MedicionValor.objects.select_related('medicion', 'campo').all()
    serializer_class = MedicionValorSerializer
    permission_classes = [AllowAny]
    lookup_field = 'id'


def obtener_texto_completo_select(parametro_id, campo_id, valor_guardado):
    """
    Obtiene el texto completo de una opción de select basándose en el valor guardado.
    Replica la lógica del formulario informativo para mostrar los valores completos.
    """
    if not valor_guardado:
        return valor_guardado
    
    # Mapeo de valores a textos completos según los selects del formulario
    mapeos = {
        # Frecuencia Cardíaca (parametro 2, campo 3)
        (2, 3): {
            "<40": "< 40 Bradicardia severa",
            "40-59": "40 – 59 Bradicardia",
            "60-100": "60 – 100 Normal",
            "101-120": "101 – 120 Taquicardia leve",
            "121-150": "121 – 150 Taquicardia",
            ">150": "> 150 Taquicardia severa"
        },
        # Frecuencia Respiratoria (parametro 3, campo 4)
        (3, 4): {
            "<8": "< 8 Bradipnea",
            "8-11": "8 – 11 FR baja",
            "12-20": "12 – 20 Normal",
            "21-30": "21 – 30 Taquipnea",
            ">30": "> 30 Distrés respiratorio"
        },
        # Temperatura (parametro 4, campo 5)
        (4, 5): {
            "<32.0": "< 32.0 Hipotermia profunda",
            "32.0-34.9": "32.0 – 34.9 Hipotermia moderada",
            "35.0-35.9": "35.0 – 35.9 Hipotermia leve",
            "36.0-37.4": "36.0 – 37.4 Normotermia",
            "37.5-37.9": "37.5 – 37.9 Febrícula",
            "38.0-38.9": "38.0 – 38.9 Fiebre",
            "39.0-40.9": "39.0 – 40.9 Hipertermia",
            ">=41.0": "≥ 41.0 Emergencia vital"
        },
        # Dinámica Uterina (parametro 5, campo 16)
        (5, 16): {
            "0": "0 Sin dinámica",
            "1-2": "1–2 Fase latente",
            "3-5": "3–5 Trabajo activo",
            ">5": "> 5 Taquisistolia"
        },
        # Intensidad (parametro 6, campo 17)
        (6, 17): {
            "<30": "< 30 Ineficaz",
            "30-60": "30 – 60 Normal",
            "61-90": "61 – 90 Fuerte",
            ">90": "> 90 Riesgo fetal"
        },
        # Contracciones (parametro 7, campo 9)
        (7, 9): {
            "0": "0 Ausente",
            "1": "1 Leve (+)",
            "2": "2 Moderada (++)",
            "3": "3 Fuerte (+++)",
            "4": "4 Hipertónica"
        },
        # Frecuencia Cardíaca Fetal (parametro 8, campo 6)
        (8, 6): {
            "<100": "< 100 Bradicardia severa",
            "100-109": "100 – 109 Bradicardia",
            "110-160": "110 – 160 Normal",
            "161-180": "161 – 180 Taquicardia",
            ">180": "> 180 Taquicardia severa"
        },
        # Movimientos Fetales (parametro 9, campo 10)
        (9, 10): {
            "0": "0 - Ausentes",
            "1": "1 - Disminuidos",
            "2": "2 - Presentes",
            "3": "3 - Exagerados"
        },
        # Presentación (parametro 10, campo 11) - Ya tienen el texto completo
        # Líquido Amniótico (parametro 13, campo 12) - Ya tienen el texto completo
        # Membranas Íntegras (parametro 11, campo 14) - Ya tienen el texto completo
        # Membranas Rotas (parametro 12, campo 15) - Ya tienen el texto completo
        # Dilatación (parametro 15, campo 7)
        (15, 7): {
            "0–3 Latente": "0–3 Latente",
            "4–6 Activa": "4–6 Activa",
            "7–9 Transición": "7–9 Transición",
            "10 Completa": "10 Completa"
        },
        # Categoría (parametro 18, campo 13) - Ya tienen el texto completo
        # Dosis (parametro 19, campo 20)
        (19, 20): {
            "0 No uso": "0 No uso",
            "1 – 5 Dosis baja": "1 – 5 Dosis baja",
            "6 – 20 Terapéutica": "6 – 20 Terapéutica",
            "> 20 Riesgo": "> 20 Riesgo"
        }
    }
    
    # Buscar el mapeo para este parámetro y campo
    mapeo = mapeos.get((parametro_id, campo_id))
    if mapeo:
        # Convertir valor_guardado a string si es necesario
        valor_str = str(valor_guardado).strip()
        
        # Buscar coincidencia exacta primero
        texto_completo = mapeo.get(valor_str)
        if texto_completo:
            return texto_completo
        
        # Si no hay coincidencia exacta, buscar por coincidencia parcial
        for valor_key, texto in mapeo.items():
            if valor_str in valor_key or valor_key in valor_str:
                return texto
        
        # Si el valor es numérico, intentar buscar en rangos
        try:
            valor_num = float(valor_str)
            for valor_key, texto in mapeo.items():
                # Buscar rangos como "101-120" o ">150" o "<40"
                if '-' in valor_key:
                    partes = valor_key.split('-')
                    if len(partes) == 2:
                        try:
                            min_val = float(partes[0].replace('<', '').replace('>', '').strip())
                            max_val = float(partes[1].replace('<', '').replace('>', '').strip())
                            if min_val <= valor_num <= max_val:
                                return texto
                        except (ValueError, AttributeError):
                            pass
                elif valor_key.startswith('>'):
                    try:
                        min_val = float(valor_key.replace('>', '').replace('=', '').strip())
                        if valor_num > min_val or (valor_key.startswith('>=') and valor_num >= min_val):
                            return texto
                    except (ValueError, AttributeError):
                        pass
                elif valor_key.startswith('<'):
                    try:
                        max_val = float(valor_key.replace('<', '').replace('=', '').strip())
                        if valor_num < max_val or (valor_key.startswith('<=') and valor_num <= max_val):
                            return texto
                    except (ValueError, AttributeError):
                        pass
        except (ValueError, TypeError):
            pass
    
    # Si no se encuentra mapeo, retornar el valor original
    return valor_guardado


def vista_impresion_formulario(request, formulario_id):
    """
    Vista optimizada para impresión en formato A4 (HTML a PDF).
    """
    formulario = get_object_or_404(Formulario.objects.select_related('paciente', 'aseguradora'), id=formulario_id)
    
    # Obtener items, parámetros y campos
    items = Item.objects.prefetch_related('parametros__campos').all().order_by('id')
    
    # Obtener todas las mediciones del formulario
    mediciones_qs = Medicion.objects.filter(formulario=formulario).prefetch_related('valores__campo')
    
    # Organizar horas únicas (columnas) para el encabezado
    # Usar las fechas tal como vienen de la base de datos, sin conversión de zona horaria
    # para que coincidan con las que se muestran en el formulario web
    from django.utils import timezone
    horas_unicas = sorted(list(set(m.tomada_en for m in mediciones_qs)))[:10]
    # Asegurar que las fechas se mantengan en la zona horaria local (Colombia)
    # sin conversión adicional
    
    # Mapear mediciones para fácil acceso en el template: {param_id: {hora_iso: {campo_id: valor}}}
    # Usar el mismo formato de fecha que se usa en el formulario web
    grid_data = {}
    for m in mediciones_qs:
        p_id = m.parametro_id
        # Usar isoformat() para mantener consistencia con el formato de la API
        # Django ya maneja la conversión de zona horaria según USE_TZ y TIME_ZONE
        h_str = m.tomada_en.isoformat()
        
        if p_id not in grid_data:
            grid_data[p_id] = {}
        if h_str not in grid_data[p_id]:
            grid_data[p_id][h_str] = {}
            
        for v in m.valores.all():
            valor = ""
            # Priorizar valor_text sobre valor_number (para compatibilidad con datos antiguos)
            if v.valor_text:
                valor = v.valor_text
                # Si es un campo de tiempo (parametro-id="17", campo-id="19" o parametro-id="14", campo-id="18"), convertir a formato 12 horas
                if (p_id == 17 and v.campo_id == 19) or (p_id == 14 and v.campo_id == 18):
                    # El valor viene en formato "HH:MM" (24 horas), convertir a formato 12 horas
                    hora_match = re.match(r'^(\d{1,2}):(\d{2})$', valor)
                    if hora_match:
                        horas = int(hora_match.group(1))
                        minutos = hora_match.group(2)
                        ampm = 'p. m.' if horas >= 12 else 'a. m.'
                        horas = horas % 12
                        horas = horas if horas else 12  # Si es 0, mostrar 12
                        valor = f"{horas:02d}:{minutos} {ampm}"
                else:
                    # Para otros campos, buscar el texto completo del select
                    valor = obtener_texto_completo_select(p_id, v.campo_id, valor)
            elif v.valor_number is not None:
                # Compatibilidad con datos antiguos que puedan estar en valor_number
                valor = float(v.valor_number)
                if valor.is_integer(): valor = int(valor)
                valor = str(valor)
                # Intentar obtener el texto completo también para valores numéricos antiguos
                valor = obtener_texto_completo_select(p_id, v.campo_id, valor)
            elif v.valor_boolean is not None:
                valor = "SÍ" if v.valor_boolean else "NO"
                # Para campos booleanos, buscar el texto completo
                if p_id == 11 and v.campo_id == 14:
                    # Membranas íntegras
                    valor = "Sí - Bolsa amniótica íntegra" if v.valor_boolean else "No - Ya hubo ruptura"
                elif p_id == 12 and v.campo_id == 15:
                    # Membranas rotas
                    valor = "Sí – Espontánea o artificial" if v.valor_boolean else "No - Membranas aún íntegras"
                
            grid_data[p_id][h_str][v.campo_id] = valor

    context = {
        'f': formulario,
        'p': formulario.paciente,
        'items': items,
        'horas': horas_unicas,
        'grid_data': grid_data,
    }
    return render(request, 'impresion_formulario.html', context)


def formulario_clinico(request):
    # Obtener todos los items con sus parámetros y campos ordenados
    items = Item.objects.prefetch_related(
        'parametros',
        'parametros__campos'
    ).all().order_by('id')
    
    context = {
        'items': items
    }
    
    return render(request, 'formulario_clinico.html', context)


def generar_pdf_formulario(request, formulario_id):
    """
    Vista para generar y descargar el PDF de un formulario clínico.
    PDF por formulario - Estructura base obligatoria
    """
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from django.http import HttpResponse
    from .pdf_utils import encabezado, datos_paciente, seccion_mediciones
    from .models import Formulario
    
    # Crear respuesta HTTP para el PDF
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="formulario_{formulario_id}.pdf"'
    
    # Crear canvas del PDF
    c = canvas.Canvas(response, pagesize=A4)
    ancho, alto = A4
    
    # Posiciones iniciales
    y = alto - 2*cm
    margen_x = 2*cm
    
    # Obtener formulario con relaciones necesarias
    formulario = Formulario.objects.select_related(
        "paciente",
        "aseguradora"
    ).get(id=formulario_id)
    
    # Estructura base del PDF (OBLIGATORIO)
    y = encabezado(c, formulario, ancho, y)
    y -= 3.2*cm
    
    y = datos_paciente(c, formulario, margen_x, y)
    y -= 1*cm
    
    from .pdf_utils import seccion_grid_mediciones
    seccion_grid_mediciones(c, formulario, margen_x, y, ancho)
    
    # Finalizar página y guardar
    c.showPage()
    c.save()
    
    return response


def preview_pdf_paciente(request, paciente_id):
    """
    Vista de prueba para ver los datos que se incluirán en el PDF
    """
    from django.shortcuts import get_object_or_404
    
    paciente = get_object_or_404(Paciente, id=paciente_id)
    
    formularios = Formulario.objects.filter(paciente=paciente).select_related(
        'aseguradora'
    ).prefetch_related(
        'parametros_formulario__item',
        'parametros_formulario__parametro__campos'
    )
    
    # Preparar datos para mostrar
    datos_paciente = {
        'id': paciente.id,
        'nombres': paciente.nombres,
        'num_identificacion': paciente.num_identificacion,
        'num_historia_clinica': paciente.num_historia_clinica,
        'fecha_nacimiento': paciente.fecha_nacimiento.strftime('%d/%m/%Y') if paciente.fecha_nacimiento else None,
        'tipo_sangre': paciente.get_tipo_sangre_display() if paciente.tipo_sangre else None,
    }
    
    datos_formularios = []
    for formulario in formularios:
        # Obtener items únicos
        items_dict = {}
        for fip in formulario.parametros_formulario.select_related('item', 'parametro').prefetch_related('parametro__campos').all():
            item = fip.item
            if item.id not in items_dict:
                items_dict[item.id] = {'item': item, 'parametros': []}
            items_dict[item.id]['parametros'].append(fip.parametro)
        
        # Preparar datos de items y parámetros
        items_data = []
        for item_id, item_data in items_dict.items():
            item = item_data['item']
            parametros_data = []
            
            for parametro in item_data['parametros']:
                campos_data = []
                campos = parametro.campos.all()
                
                for campo in campos:
                    valor = MedicionValor.objects.filter(
                        medicion__formulario=formulario,
                        campo=campo
                    ).select_related('medicion', 'campo').first()
                    
                    # Obtener el valor según el tipo
                    if valor:
                        if valor.valor_number is not None:
                            texto_valor = str(valor.valor_number)
                        elif valor.valor_text:
                            texto_valor = valor.valor_text
                        elif valor.valor_boolean is not None:
                            texto_valor = 'Sí' if valor.valor_boolean else 'No'
                        elif valor.valor_json:
                            texto_valor = str(valor.valor_json)
                        else:
                            texto_valor = "—"
                    else:
                        texto_valor = "—"
                    
                    campos_data.append({
                        'nombre': campo.nombre,
                        'valor': texto_valor,
                        'unidad': campo.unidad or '',
                    })
                
                parametros_data.append({
                    'nombre': parametro.nombre,
                    'campos': campos_data,
                })
            
            items_data.append({
                'nombre': item.nombre,
                'parametros': parametros_data,
            })
        
        datos_formularios.append({
            'id': formulario.id,
            'codigo': formulario.codigo,
            'version': formulario.version,
            'fecha_elabora': formulario.fecha_elabora.strftime('%d/%m/%Y') if formulario.fecha_elabora else None,
            'fecha_actualizacion': formulario.fecha_actualizacion.strftime('%d/%m/%Y %H:%M') if formulario.fecha_actualizacion else None,
            'num_hoja': formulario.num_hoja,
            'aseguradora': formulario.aseguradora.nombre if formulario.aseguradora else None,
            'diagnostico': formulario.diagnostico,
            'edad_snapshot': formulario.edad_snapshot,
            'edad_gestion': formulario.edad_gestion,
            'estado': formulario.get_estado_display() if formulario.estado else None,
            'n_controles_prenatales': formulario.n_controles_prenatales,
            'responsable': formulario.responsable,
            'items': items_data,
        })
    
    context = {
        'paciente': datos_paciente,
        'formularios': datos_formularios,
        'paciente_id': paciente_id,
    }
    
    return render(request, 'preview_pdf.html', context)


def generar_pdf_paciente(request, paciente_id):
    paciente = Paciente.objects.get(id=paciente_id)
    
    formularios = Formulario.objects.filter(paciente=paciente).select_related(
        'aseguradora'
    ).prefetch_related(
        'parametros_formulario__item',
        'parametros_formulario__parametro__campos'
    )
    
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="paciente_{paciente.id}.pdf"'
    
    p = canvas.Canvas(response, pagesize=A4)
    width, height = A4
    y = height - 40
    
    # ===== ENCABEZADO =====
    p.setFont("Helvetica-Bold", 16)
    p.drawCentredString(width / 2, y, "FORMULARIO CLÍNICO")
    y -= 40
    
    # ===== DATOS PACIENTE =====
    p.setFont("Helvetica-Bold", 12)
    p.drawString(40, y, "Datos del Paciente")
    y -= 20
    
    p.setFont("Helvetica", 10)
    p.drawString(40, y, f"Nombre: {paciente.nombres}")
    y -= 15
    
    p.drawString(40, y, f"Documento: {paciente.num_identificacion}")
    y -= 15
    
    p.drawString(40, y, f"Historia Clínica: {paciente.num_historia_clinica}")
    y -= 15
    
    if paciente.fecha_nacimiento:
        p.drawString(40, y, f"Fecha de Nacimiento: {paciente.fecha_nacimiento.strftime('%d/%m/%Y')}")
        y -= 15
    
    if paciente.tipo_sangre:
        p.drawString(40, y, f"Tipo de Sangre: {paciente.get_tipo_sangre_display()}")
        y -= 15
    
    y -= 20
    
    # ===== FORMULARIOS =====
    for formulario in formularios:
        p.setFont("Helvetica-Bold", 12)
        p.drawString(40, y, f"Formulario: {formulario.codigo} v{formulario.version}")
        y -= 15
        
        p.setFont("Helvetica", 10)
        # Datos del formulario desde la tabla
        if formulario.fecha_elabora:
            p.drawString(40, y, f"Fecha de Elaboración: {formulario.fecha_elabora.strftime('%d/%m/%Y')}")
            y -= 15
        
        if formulario.fecha_actualizacion:
            p.drawString(40, y, f"Fecha de Actualización: {formulario.fecha_actualizacion.strftime('%d/%m/%Y %H:%M')}")
            y -= 15
        
        p.drawString(40, y, f"Número de Hoja: {formulario.num_hoja}")
        y -= 15
        
        if formulario.aseguradora:
            p.drawString(40, y, f"Aseguradora: {formulario.aseguradora.nombre}")
            y -= 15
        
        if formulario.diagnostico:
            p.drawString(40, y, f"Diagnóstico: {formulario.diagnostico}")
            y -= 15
        
        if formulario.edad_snapshot is not None:
            p.drawString(40, y, f"Edad Snapshot: {formulario.edad_snapshot} años")
            y -= 15
        
        if formulario.edad_gestion is not None:
            p.drawString(40, y, f"Edad Gestación: {formulario.edad_gestion} semanas")
            y -= 15
        
        if formulario.estado:
            estado_display = formulario.get_estado_display()
            p.drawString(40, y, f"Estado: {estado_display}")
            y -= 15
        
        if formulario.n_controles_prenatales is not None:
            p.drawString(40, y, f"Número de Controles Prenatales: {formulario.n_controles_prenatales}")
            y -= 15
        
        if formulario.responsable:
            p.drawString(40, y, f"Responsable: {formulario.responsable}")
            y -= 15
        
        y -= 10
        
        # Obtener items únicos a través de parametros_formulario
        items_dict = {}
        for fip in formulario.parametros_formulario.select_related('item', 'parametro').prefetch_related('parametro__campos').all():
            item = fip.item
            if item.id not in items_dict:
                items_dict[item.id] = {'item': item, 'parametros': []}
            items_dict[item.id]['parametros'].append(fip.parametro)
        
        # ===== ITEMS =====
        for item_id, item_data in items_dict.items():
            item = item_data['item']
            p.setFont("Helvetica-Bold", 11)
            p.drawString(60, y, f"- {item.nombre}")
            y -= 15
            
            # ===== PARÁMETROS =====
            for parametro in item_data['parametros']:
                p.setFont("Helvetica", 10)
                p.drawString(80, y, f"{parametro.nombre}:")
                y -= 15
                
                # ===== CAMPOS / VALORES =====
                campos = parametro.campos.all()
                for campo in campos:
                    valor = MedicionValor.objects.filter(
                        medicion__formulario=formulario,
                        campo=campo
                    ).select_related('medicion', 'campo').first()
                    
                    # Obtener el valor según el tipo
                    if valor:
                        if valor.valor_number is not None:
                            texto_valor = str(valor.valor_number)
                        elif valor.valor_text:
                            texto_valor = valor.valor_text
                        elif valor.valor_boolean is not None:
                            texto_valor = 'Sí' if valor.valor_boolean else 'No'
                        elif valor.valor_json:
                            texto_valor = str(valor.valor_json)
                        else:
                            texto_valor = "—"
                    else:
                        texto_valor = "—"
                    
                    unidad = campo.unidad or ''
                    if unidad:
                        texto_completo = f"{campo.nombre}: {texto_valor} {unidad}"
                    else:
                        texto_completo = f"{campo.nombre}: {texto_valor}"
                    
                    p.drawString(100, y, texto_completo)
                    y -= 15
                    
                    # Control de paginación
                    if y < 60:
                        p.showPage()
                        y = height - 40
            
            y -= 10
        
        y -= 20
    
    p.showPage()
    p.save()
    
    return response

