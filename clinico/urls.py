from django.urls import path

from .views import (
    formulario_clinico, 
    generar_pdf_formulario, 
    generar_pdf_paciente, 
    preview_pdf_paciente,
    vista_impresion_formulario
)

urlpatterns = [
    path('', formulario_clinico, name='home'),
    path('formulario-clinico/', formulario_clinico, name='formulario_clinico'),
    path('formulario/<int:formulario_id>/pdf/', generar_pdf_formulario, name='generar_pdf_formulario'),
    path('formulario/<int:formulario_id>/impresion/', vista_impresion_formulario, name='vista_impresion_formulario'),
    path('pacientes/<int:paciente_id>/pdf/', generar_pdf_paciente, name='generar_pdf_paciente'),
    path('pacientes/<int:paciente_id>/preview/', preview_pdf_paciente, name='preview_pdf_paciente'),
]

