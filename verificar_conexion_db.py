"""
Script para verificar la conexión a PostgreSQL antes de ejecutar migraciones.
Ejecuta: python verificar_conexion_db.py
"""
import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'desarrollo_app.settings')
django.setup()

from django.db import connection
from django.conf import settings

def verificar_configuracion():
    """Verifica la configuración de la base de datos"""
    print("=" * 60)
    print("VERIFICACIÓN DE CONFIGURACIÓN DE BASE DE DATOS")
    print("=" * 60)
    
    db_config = settings.DATABASES['default']
    
    print("\n📋 Configuración actual:")
    print(f"   ENGINE: {db_config['ENGINE']}")
    print(f"   NAME: {db_config['NAME']}")
    print(f"   USER: {db_config['USER']}")
    print(f"   HOST: {db_config['HOST']}")
    print(f"   PORT: {db_config['PORT']}")
    print(f"   PASSWORD: {'*' * len(db_config['PASSWORD']) if db_config['PASSWORD'] else '(vacío)'}")
    
    # Verificar que no estén los valores por defecto
    valores_por_defecto = ["tu_bd", "tu_usuario", "tu_password"]
    problemas = []
    
    if db_config['NAME'] in valores_por_defecto:
        problemas.append(f"❌ El nombre de la base de datos ('{db_config['NAME']}') parece ser un valor por defecto")
    
    if db_config['USER'] in valores_por_defecto:
        problemas.append(f"❌ El usuario ('{db_config['USER']}') parece ser un valor por defecto")
    
    if not db_config['PASSWORD']:
        problemas.append("⚠️  La contraseña está vacía (puede ser correcto si PostgreSQL no requiere contraseña)")
    
    if problemas:
        print("\n⚠️  ADVERTENCIAS:")
        for problema in problemas:
            print(f"   {problema}")
    else:
        print("\n✅ La configuración parece estar completa")
    
    return problemas

def verificar_conexion():
    """Intenta conectar a la base de datos"""
    print("\n" + "=" * 60)
    print("PRUEBA DE CONEXIÓN")
    print("=" * 60)
    
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
            print(f"\n✅ CONEXIÓN EXITOSA!")
            print(f"\n📊 Información de PostgreSQL:")
            print(f"   {version}")
            
            # Verificar si la base de datos existe
            cursor.execute("SELECT current_database();")
            db_name = cursor.fetchone()[0]
            print(f"\n📂 Base de datos actual: {db_name}")
            
            return True
            
    except Exception as e:
        print(f"\n❌ ERROR AL CONECTAR:")
        print(f"   {str(e)}")
        print("\n💡 Posibles soluciones:")
        print("   1. Verifica que PostgreSQL esté ejecutándose")
        print("   2. Verifica que la base de datos exista (crea una si no existe)")
        print("   3. Verifica usuario y contraseña en settings.py")
        print("   4. Verifica que el host y puerto sean correctos")
        print("   5. Si usas variables de entorno, asegúrate de haberlas configurado")
        return False

def instrucciones():
    """Muestra instrucciones para configurar variables de entorno"""
    print("\n" + "=" * 60)
    print("CONFIGURACIÓN DE VARIABLES DE ENTORNO")
    print("=" * 60)
    print("\nPara Windows (PowerShell):")
    print("   $env:POSTGRES_DB='nombre_base_datos'")
    print("   $env:POSTGRES_USER='tu_usuario'")
    print("   $env:POSTGRES_PASSWORD='tu_contraseña'")
    print("   $env:POSTGRES_HOST='localhost'")
    print("   $env:POSTGRES_PORT='5432'")
    
    print("\nPara Windows (CMD):")
    print("   set POSTGRES_DB=nombre_base_datos")
    print("   set POSTGRES_USER=tu_usuario")
    print("   set POSTGRES_PASSWORD=tu_contraseña")
    print("   set POSTGRES_HOST=localhost")
    print("   set POSTGRES_PORT=5432")
    
    print("\nO edita directamente los valores en desarrollo_app/settings.py")

if __name__ == "__main__":
    print("\n")
    problemas = verificar_configuracion()
    
    if problemas and any("❌" in p for p in problemas):
        print("\n⚠️  Por favor, corrige la configuración antes de continuar")
        instrucciones()
        sys.exit(1)
    
    print("\n" + "=" * 60)
    respuesta = input("¿Deseas probar la conexión ahora? (s/n): ").lower()
    
    if respuesta == 's':
        exito = verificar_conexion()
        if exito:
            print("\n" + "=" * 60)
            print("✅ TODO LISTO PARA EJECUTAR MIGRACIONES")
            print("=" * 60)
            print("\nPuedes ejecutar:")
            print("   python manage.py migrate clinico")
            print("\n")
        else:
            instrucciones()
            sys.exit(1)
    else:
        instrucciones()

