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
    
    def get_serializer_class(self):
        """Retorna el serializador apropiado según la acción"""
        if self.action == 'list':
            return PacienteListSerializer
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


def formulario_clinico(request):
    return render(request, 'formulario_clinico.html')


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
    y -= 3*cm
    
    seccion_mediciones(c, formulario, margen_x, y)
    
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

