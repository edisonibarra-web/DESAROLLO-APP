// Configuración de la API
const API_BASE_URL = '/api';

// Utilidades
function getCSRFToken() {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
  }

function calcularEdad(fechaNacimiento) {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
    }
    
    return edad;
}

  function obtenerDatosFormulario() {
    return {
      codigo: document.getElementById('codigo').value,
      version: document.getElementById('version').value,
      fecha_elabora: document.getElementById('fecha_elabora').value,
      num_hoja: document.getElementById('num_hoja').value,
      estado: document.getElementById('estado').value,
      diagnostico: document.getElementById('diagnostico').value,
      edad_snapshot: document.getElementById('edad_snapshot').value,
      edad_gestion: document.getElementById('edad_gestion').value,
      n_controles_prenatales: document.getElementById('n_controles_prenatales').value,
      responsable: document.getElementById('responsable').value,
      paciente: document.getElementById('paciente_id').value,
      aseguradora: document.getElementById('aseguradora_id').value
    };
  }
  
// El event listener del formulario está en el bloque DOMContentLoaded principal (línea ~337)
  

async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        },
        credentials: 'same-origin', // 🔥 CLAVE
    };

    const csrfToken = getCSRFToken();
    if (csrfToken) {
        options.headers['X-CSRFToken'] = csrfToken;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    // Agregar timestamp si no está presente en la URL para evitar caché
    let url = `${API_BASE_URL}${endpoint}`;
    if (method === 'GET' && !url.includes('?_=')) {
        url += (url.includes('?') ? '&' : '?') + '_=' + new Date().getTime();
    }
    console.log(`🌐 Haciendo petición ${method} a: ${url}`);
    if (data) {
        console.log('📤 Datos enviados:', data);
    }
    
    const response = await fetch(url, options);
    
    console.log(`Respuesta recibida: ${response.status} ${response.statusText}`);

    if (response.ok) {
        // Log exitoso para respuestas 200 OK
        console.log(`Petición exitosa: ${method} ${url} - Status: ${response.status}`);
    }

    if (!response.ok) {
        const text = await response.text();
        console.error(`Error en la respuesta:`, {
            status: response.status,
            statusText: response.statusText,
            body: text
        });
        
        // Intentar parsear como JSON si es posible
        let errorMessage = text || 'Error en la petición';
        let errorDetails = {};
        
        try {
            const errorJson = JSON.parse(text);
            errorDetails = errorJson;
            
            if (errorJson.detail) {
                errorMessage = errorJson.detail;
            } else if (errorJson.message) {
                errorMessage = errorJson.message;
            } else if (typeof errorJson === 'object') {
                // Si hay errores de validación, mostrarlos
                const validationErrors = Object.entries(errorJson)
                    .map(([key, value]) => {
                        const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        const errorText = Array.isArray(value) ? value.join(', ') : value;
                        return `${fieldName}: ${errorText}`;
                    })
                    .join('\n');
                if (validationErrors) {
                    errorMessage = validationErrors;
                }
            }
        } catch (e) {
            // Si no es JSON, usar el texto tal cual
        }
        
        // Mostrar mensaje en la interfaz en lugar de alerta
        mostrarMensaje(alertMessage, 'error');
        
        throw new Error(errorMessage);
    }

    // Solo intentar JSON si hay contenido
    if (response.status === 204) {
        return null;
    }

    const jsonData = await response.json();
    
    // Log de datos recibidos para respuestas exitosas
    if (response.ok) {
        console.log(`📦 Datos recibidos:`, jsonData);
    }
    
    return jsonData;
}


// Cargar aseguradoras
async function cargarAseguradoras() {
    try {
        const aseguradoras = await apiRequest('/aseguradoras/');
        const select = document.getElementById('aseguradora_id');
        
        if (!select) return;
        
        // Limpiar opciones existentes (excepto la primera)
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Agregar aseguradoras
        aseguradoras.forEach(aseguradora => {
            const option = document.createElement('option');
            option.value = aseguradora.id;
            option.textContent = aseguradora.nombre;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar aseguradoras:', error);
        mostrarMensaje('Error al cargar aseguradoras', 'error');
    }
}

// Buscar paciente
async function buscarPaciente() {
    const numIdentificacion = document.getElementById('num_identificacion').value.trim();
    const numHistoriaClinica = document.getElementById('num_historia_clinica').value.trim();
    
    if (!numIdentificacion && !numHistoriaClinica) {
        mostrarMensaje('Ingrese número de identificación o historia clínica', 'error');
        return;
    }
    
    try {
        let queryParams = '';
        if (numIdentificacion) {
            queryParams = `?num_identificacion=${numIdentificacion}`;
        } else if (numHistoriaClinica) {
            queryParams = `?num_historia_clinica=${numHistoriaClinica}`;
        }

        console.log(`Realizando búsqueda general con: ${queryParams}`);
        const pacientes = await apiRequest(`/pacientes/${queryParams}`);
        const paciente = (pacientes && pacientes.length > 0) ? pacientes[0] : null;
        
        console.log('Resultados de búsqueda de paciente:', pacientes);
        
        if (paciente) {
            console.log('Datos del paciente encontrados:', paciente);
            // Llenar campos del paciente
            document.getElementById('paciente_id').value = paciente.id;
            document.getElementById('num_historia_clinica').value = paciente.num_historia_clinica;
            document.getElementById('num_identificacion').value = paciente.num_identificacion;
            document.getElementById('nombres').value = paciente.nombres;
            if (paciente.tipo_sangre) {
                document.getElementById('tipo_sangre').value = paciente.tipo_sangre;
            }
            const fechaElaboraPaciente = document.getElementById('fecha_elabora_paciente');
            if (fechaElaboraPaciente) {
                const hoy = obtenerFechaLocalColombia();
                fechaElaboraPaciente.value = paciente.fecha_nacimiento || hoy;
            }
            if (paciente.fecha_nacimiento) {
                // Calcular edad automáticamente al buscar
                if (document.getElementById('edad_snapshot')) {
                    document.getElementById('edad_snapshot').value = calcularEdad(paciente.fecha_nacimiento);
                }
            }
            
            mostrarMensaje('Paciente encontrado', 'success');
        } else {
            mostrarMensaje('Paciente no encontrado', 'info');
            // Limpiar los campos si no se encontró el paciente
            limpiarFormulario();
            // Mantener los valores de búsqueda para que el usuario sepa qué buscó
            if (numIdentificacion) document.getElementById('num_identificacion').value = numIdentificacion;
            if (numHistoriaClinica) document.getElementById('num_historia_clinica').value = numHistoriaClinica;
        }
    } catch (error) {
        console.error('Error al buscar paciente:', error);
        mostrarMensaje('Error al buscar paciente', 'error');
    }
}

// Crear o actualizar paciente
async function guardarPaciente() {
    console.log('Iniciando guardarPaciente...');
    
    const numHistoriaClinica = document.getElementById('num_historia_clinica')?.value;
    const numIdentificacion = document.getElementById('num_identificacion')?.value;
    const nombres = document.getElementById('nombres')?.value;
    
    // Validar campos requeridos
    if (!numHistoriaClinica || !numIdentificacion || !nombres) {
        const camposFaltantes = [];
        if (!numHistoriaClinica) camposFaltantes.push('N° Historia Clínica');
        if (!numIdentificacion) camposFaltantes.push('Identificación');
        if (!nombres) camposFaltantes.push('Nombre');
        throw new Error(`Campos de paciente requeridos faltantes: ${camposFaltantes.join(', ')}`);
    }
    
    const pacienteData = {
        num_historia_clinica: numHistoriaClinica,
        num_identificacion: numIdentificacion,
        nombres: nombres,
        tipo_sangre: document.getElementById('tipo_sangre')?.value || null,
        fecha_nacimiento: document.getElementById('fecha_elabora_paciente')?.value || null,
    };
    
    console.log('Datos del paciente a guardar:', pacienteData);
    
    const pacienteId = document.getElementById('paciente_id')?.value;
    console.log('Paciente ID actual:', pacienteId || 'Nuevo paciente');
    
    try {
        let paciente;
        if (pacienteId) {
            console.log(`Actualizando paciente existente con ID: ${pacienteId}`);
            // Actualizar paciente existente
            paciente = await apiRequest(`/pacientes/${pacienteId}/`, 'PUT', pacienteData);
            console.log('Paciente actualizado:', paciente);
        } else {
            console.log('Creando nuevo paciente...');
            // Crear nuevo paciente
            paciente = await apiRequest('/pacientes/', 'POST', pacienteData);
            console.log('Paciente creado:', paciente);
            if (paciente && paciente.id) {
                document.getElementById('paciente_id').value = paciente.id;
                console.log('ID del paciente guardado:', paciente.id);
            }
        }
        
        return paciente;
    } catch (error) {
        console.error('Error al guardar paciente:', error);
        console.error('Detalles del error:', {
            message: error.message,
            stack: error.stack
        });
        
        // Mostrar mensaje más descriptivo
        let mensajeError = 'Error al guardar paciente: ';
        let alertMessage = '';
        
        if (error.message.includes('num_historia_clinica') || error.message.includes('historia clínica')) {
            mensajeError = 'Error al guardar paciente';
        } else if (error.message.includes('num_identificacion') || error.message.includes('identificación')) {
            mensajeError = 'Error al guardar paciente';
        } else {
            mensajeError = 'Error al guardar paciente';
        }
        
        // Mostrar mensaje en la interfaz
        mostrarMensaje(mensajeError, 'error');
        throw error;
    }
}

// Guardar formulario
async function guardarFormulario() {
    console.log('Iniciando guardarFormulario...');
    
    // Verificar si es una actualización y mostrar confirmación
    const btnGuardar = document.getElementById('btn-guardar');
    const esActualizacion = btnGuardar && btnGuardar.getAttribute('data-es-actualizacion') === 'true';
    const formularioId = document.getElementById('formulario_id').value;
    
    if (esActualizacion || formularioId) {
        const confirmar = confirm('¿En verdad desea modificar la información?');
        if (!confirmar) {
            console.log('Actualización cancelada por el usuario');
            return;
        }
    }
    
    try {
        console.log('Guardando paciente...');
        // Primero guardar/actualizar paciente
        await guardarPaciente();
        
        const pacienteId = document.getElementById('paciente_id').value;
        console.log('Paciente ID después de guardar:', pacienteId);
        if (!pacienteId) {
            console.error('No se pudo obtener el ID del paciente');
            mostrarMensaje('Complete los campos del paciente', 'error');
            return;
        }
        
        console.log('Preparando datos del formulario...');
        
        // Preparar datos del formulario
        console.log('Obteniendo valores de los campos...');

        // Campo CÓDIGO ahora es visual/estático en el encabezado.
        // Si no hay input o viene vacío, usamos el código fijo del formato: FRSPA-022
        const codigoInput = document.getElementById('codigo');
        const codigo = (codigoInput && codigoInput.value) ? codigoInput.value : 'FRSPA-022';

        const version = document.getElementById('version')?.value;
        const estado = document.getElementById('estado')?.value;
        const responsable = document.getElementById('responsable')?.value;
        
        // Validar campos requeridos
        // Nota: CÓDIGO ya se fuerza a un valor por defecto (FRSPA-022), por eso
        // solo validamos que versión, estado y responsable estén diligenciados.
        if (!version || !estado || !responsable) {
            const camposFaltantes = [];
            if (!version) camposFaltantes.push('Versión');
            if (!estado) camposFaltantes.push('Estado');
            if (!responsable) camposFaltantes.push('Responsable');
            throw new Error(`Campos requeridos faltantes: ${camposFaltantes.join(', ')}`);
        }
        
        const formularioData = {
            codigo: codigo,
            version: version,
            fecha_elabora: document.getElementById('fecha_elabora')?.value || obtenerFechaLocalColombia(),
            num_hoja: parseInt(document.getElementById('num_hoja')?.value || '1'),
            paciente: pacienteId,
            aseguradora: document.getElementById('aseguradora_id')?.value || null,
            diagnostico: document.getElementById('diagnostico')?.value || null,
            edad_snapshot: document.getElementById('edad_snapshot')?.value ? 
                          parseInt(document.getElementById('edad_snapshot').value) : null,
            edad_gestion: document.getElementById('edad_gestion')?.value ? 
                         parseInt(document.getElementById('edad_gestion').value) : null,
            estado: estado,
            n_controles_prenatales: document.getElementById('n_controles_prenatales')?.value ? 
                                   parseInt(document.getElementById('n_controles_prenatales').value) : null,
            responsable: responsable,
        };
        
        console.log('Datos del formulario preparados:', formularioData);
        
        let formulario;
        
        if (formularioId) {
            console.log('Actualizando formulario existente con ID:', formularioId);
            // Actualizar formulario existente
            formulario = await apiRequest(`/formularios/${formularioId}/`, 'PUT', formularioData);
        } else {
            console.log('Creando nuevo formulario...');
            // Crear nuevo formulario
            formulario = await apiRequest('/formularios/', 'POST', formularioData);
            console.log('Formulario creado:', formulario);
            if (formulario && formulario.id) {
                document.getElementById('formulario_id').value = formulario.id;
            }
        }
        if (!formulario || !formulario.id) {
            console.error('Formulario no creado correctamente:', formulario);
            throw new Error('Formulario no creado correctamente');
        }
        
        console.log('Guardando mediciones para formulario ID:', formulario.id);
        // Guardar mediciones
        await guardarMediciones(formulario.id);
        console.log('Mediciones guardadas exitosamente');
        
        // Actualizar el ID del formulario en el campo oculto
        document.getElementById('formulario_id').value = formulario.id;
        
        // Actualizar el formulario informativo con los datos guardados
        // Esto asegura que el acordeón muestre los datos más recientes
        try {
            await actualizarFormularioInformativo(formulario.id);
            console.log('Formulario informativo actualizado correctamente');
        } catch (error) {
            console.error('Error al actualizar formulario informativo:', error);
            // No fallar el guardado si hay error en la actualización del informativo
        }
        
        const mensaje = esActualizacion ? 'Datos actualizados correctamente' : 'Datos guardados correctamente';
        mostrarMensaje(mensaje, 'success');
        
        // Limpiar el formulario después de un breve delay para que vean el mensaje
        // Nota: El formulario informativo (acordeón) NO se limpia, solo el formulario principal
        setTimeout(() => {
            limpiarFormulario();
            console.log('Formulario reseteado tras guardado exitoso.');
        }, 1500);
        
    } catch (error) {
        console.error('Error al guardar formulario:', error);
        
        // Mensaje de error genérico
        let alertMessage = 'Error al guardar formulario';
        
        if (error.message.includes('Campos requeridos')) {
            alertMessage = 'Complete los campos requeridos';
        }
        
        mostrarMensaje(alertMessage, 'error');
    }
}

// Función para actualizar el formulario informativo (colapsable) con los datos guardados
async function actualizarFormularioInformativo(formularioId) {
    try {
        console.log(`Actualizando formulario informativo para el formulario ${formularioId}...`);
        
        // Agregar timestamp para evitar caché del navegador
        const timestamp = new Date().getTime();
        
        // Obtener datos del formulario completo desde la API (sin caché)
        const formulario = await apiRequest(`/formularios/${formularioId}/?_=${timestamp}`);
        console.log('Formulario recibido desde la API:', formulario);
        
        if (!formulario) {
            console.log('No se encontró el formulario.');
            return;
        }
        
        // Obtener mediciones desde la API (sin caché)
        const mediciones = await apiRequest(`/formularios/${formularioId}/mediciones/?_=${timestamp}`);
        console.log('Mediciones recibidas desde la API:', mediciones);
        
        // Obtener el contenedor del formulario informativo
        const collapsibleBody = document.querySelector('.collapsible-body');
        if (!collapsibleBody) {
            console.log('No se encontró el contenedor del formulario informativo.');
            return;
        }
        
        // SIEMPRE obtener datos completos del paciente desde la API (no usar caché)
        // Esto asegura que tenemos todos los datos actualizados desde la base de datos
        const pacienteId = formulario.paciente ? formulario.paciente.id : null;
        let paciente = null;
        
        if (pacienteId) {
            try {
                // Obtener datos completos del paciente desde la API (sin caché)
                paciente = await apiRequest(`/pacientes/${pacienteId}/?_=${timestamp}`);
                if (paciente) {
                    console.log('Datos completos del paciente obtenidos desde la API:', paciente);
                } else {
                    // Fallback: usar datos del formulario si no se puede obtener el paciente
                    paciente = formulario.paciente;
                    console.warn('No se pudieron obtener los datos completos del paciente, usando datos del formulario');
                }
            } catch (error) {
                console.error('Error al obtener datos del paciente:', error);
                // Fallback: usar datos del formulario
                paciente = formulario.paciente;
            }
        } else {
            // Si no hay ID de paciente, usar los datos del formulario
            paciente = formulario.paciente;
        }
        
        if (paciente) {
            const patientTable = collapsibleBody.querySelector('.patient-table');
            
            if (patientTable) {
                const rows = patientTable.querySelectorAll('tr');
                
                // Primera fila: DD/MM/AA, ASEGURADORA, N° HISTORIA CLÍNICA
                if (rows.length > 0) {
                    const cells = rows[0].querySelectorAll('td');
                    if (cells.length > 1) {
                        // DD/MM/AA - Usar fecha_elabora del formulario o fecha_nacimiento del paciente
                        const fechaSpan = cells[1].querySelector('.info-value');
                        if (fechaSpan) {
                            const fecha = formulario.fecha_elabora || paciente.fecha_nacimiento || new Date();
                            const fechaObj = new Date(fecha);
                            fechaSpan.textContent = fechaObj.toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            });
                        }
                    }
                    if (cells.length > 3) {
                        // ASEGURADORA
                        const aseguradoraSpan = cells[3].querySelector('.info-value');
                        if (aseguradoraSpan) {
                            aseguradoraSpan.textContent = formulario.aseguradora ? (formulario.aseguradora.nombre || '-') : '-';
                        }
                    }
                    if (cells.length > 5) {
                        // N° HISTORIA CLÍNICA
                        const historiaSpan = cells[5].querySelector('.info-value');
                        if (historiaSpan) {
                            historiaSpan.textContent = paciente.num_historia_clinica || '-';
                        }
                    }
                }
                
                // Segunda fila: CC. IDENTIFICACIÓN, NOMBRE Y APELLIDO
                if (rows.length > 1) {
                    const cells = rows[1].querySelectorAll('td');
                    if (cells.length > 1) {
                        // CC. IDENTIFICACIÓN
                        const identSpan = cells[1].querySelector('.info-value');
                        if (identSpan) {
                            identSpan.textContent = paciente.num_identificacion || '-';
                        }
                    }
                    if (cells.length > 3) {
                        // NOMBRE Y APELLIDO
                        const nombreSpan = cells[3].querySelector('.info-value');
                        if (nombreSpan) {
                            nombreSpan.textContent = paciente.nombres || '-';
                        }
                    }
                }
                
                // Tercera fila: DIAGNÓSTICO, EDAD, GRUPO SANGUÍNEO
                if (rows.length > 2) {
                    const cells = rows[2].querySelectorAll('td');
                    if (cells.length > 1) {
                        // DIAGNÓSTICO
                        const diagSpan = cells[1].querySelector('.info-value');
                        if (diagSpan) {
                            diagSpan.textContent = formulario.diagnostico || '-';
                        }
                    }
                    if (cells.length > 3) {
                        // EDAD - Calcular desde fecha_nacimiento si está disponible
                        const edadSpan = cells[3].querySelector('.info-value');
                        if (edadSpan) {
                            let edad = formulario.edad_snapshot;
                            if (!edad && paciente.fecha_nacimiento) {
                                edad = calcularEdad(paciente.fecha_nacimiento);
                            }
                            edadSpan.textContent = edad || '-';
                        }
                    }
                    if (cells.length > 5) {
                        // GRUPO SANGUÍNEO
                        const sangreSpan = cells[5].querySelector('.info-value');
                        if (sangreSpan) {
                            sangreSpan.textContent = paciente.tipo_sangre || '-';
                        }
                    }
                }
                
                // Cuarta fila: EDAD GESTACIONAL, G_P_C_A_V_M_, N° CONTROLES PRENATALES
                if (rows.length > 3) {
                    const cells = rows[3].querySelectorAll('td');
                    if (cells.length > 1) {
                        // EDAD GESTACIONAL
                        const edadGestSpan = cells[1].querySelector('.info-value');
                        if (edadGestSpan) {
                            edadGestSpan.textContent = (formulario.edad_gestion !== null && formulario.edad_gestion !== undefined) ? formulario.edad_gestion : '-';
                        }
                    }
                    if (cells.length > 3) {
                        // G_P_C_A_V_M_
                        const estadoSpan = cells[3].querySelector('.info-value');
                        if (estadoSpan) {
                            estadoSpan.textContent = formulario.estado_display || formulario.estado || '-';
                        }
                    }
                    if (cells.length > 5) {
                        // N° CONTROLES PRENATALES
                        const controlesSpan = cells[5].querySelector('.info-value');
                        if (controlesSpan) {
                            controlesSpan.textContent = (formulario.n_controles_prenatales !== null && formulario.n_controles_prenatales !== undefined) ? formulario.n_controles_prenatales : '-';
                        }
                    }
                }
            }
        }
        
        // Actualizar responsable
        if (formulario.responsable) {
            const responsableInfo = collapsibleBody.querySelector('.form-footer .info-value');
            if (responsableInfo) {
                responsableInfo.textContent = formulario.responsable;
            }
        }
        
        // Actualizar tabla de mediciones en el formulario informativo
        if (mediciones && mediciones.length > 0) {
            // 1. Identificar todas las horas únicas y ordenarlas
            const horasUnicas = [...new Set(mediciones.map(m => m.tomada_en))].sort();
            console.log('Horas detectadas:', horasUnicas);
            
            // 2. Llenar los spans de tiempo en el encabezado del grid informativo
            const timeSpans = collapsibleBody.querySelectorAll('.info-time');
            const horaToIndexMap = {};
            
            // Primero limpiar todas las fechas predeterminadas
            timeSpans.forEach(span => {
                span.textContent = '';
            });
            
            // Luego llenar solo las fechas que tienen datos guardados desde la base de datos
            horasUnicas.forEach((hora, index) => {
                if (index < timeSpans.length) {
                    const date = new Date(hora);
                    const fechaHora = date.toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });
                    timeSpans[index].textContent = fechaHora;
                    horaToIndexMap[hora] = index;
                }
            });
            
            // 3. Limpiar valores informativos antes de cargar
            collapsibleBody.querySelectorAll('.data-cell .info-value').forEach(span => {
                span.textContent = '-';
            });
            
            // 4. Llenar los valores en las celdas informativas
            mediciones.forEach(medicion => {
                const horaIndex = horaToIndexMap[medicion.tomada_en];
                if (horaIndex === undefined) return;
                
                const parametroId = medicion.parametro ? medicion.parametro.id : null;
                if (!parametroId) return;
                
                medicion.valores.forEach(v => {
                    const campoId = v.campo ? v.campo.id : null;
                    if (!campoId) return;
                    
                    const selector = `.info-value[data-parametro-id="${parametroId}"][data-campo-id="${campoId}"][data-hora-index="${horaIndex}"]`;
                    const span = collapsibleBody.querySelector(selector);
                    
                    if (span) {
                        // Obtener el valor no nulo y formatearlo
                        // Priorizar valor_text sobre valor_number (para compatibilidad con datos antiguos)
                        let valor = '-';
                        let valorAsignado = false;
                        
                        if (v.valor_text !== null && v.valor_text !== undefined) {
                            valor = v.valor_text;
                            
                            // Si es un campo de tiempo (parametro-id="17", campo-id="19" o parametro-id="14", campo-id="18"), convertir a formato 12 horas
                            if ((parametroId == 17 && campoId == 19) || (parametroId == 14 && campoId == 18)) {
                                // El valor viene en formato "HH:MM" (24 horas), convertir a formato 12 horas
                                const horaMatch = valor.match(/^(\d{1,2}):(\d{2})$/);
                                if (horaMatch) {
                                    let horas = parseInt(horaMatch[1]);
                                    const minutos = horaMatch[2];
                                    const ampm = horas >= 12 ? 'p. m.' : 'a. m.';
                                    horas = horas % 12;
                                    horas = horas ? horas : 12; // Si es 0, mostrar 12
                                    valor = `${horas.toString().padStart(2, '0')}:${minutos} ${ampm}`;
                                }
                            }
                        } else if (v.valor_number !== null && v.valor_number !== undefined) {
                            // Compatibilidad con datos antiguos que puedan estar en valor_number
                            valor = parseFloat(v.valor_number);
                            if (Number.isInteger(valor)) valor = parseInt(valor);
                            valor = valor.toString();
                        } else if (v.valor_boolean !== null && v.valor_boolean !== undefined) {
                            // Para campos booleanos, convertir a texto
                            valor = v.valor_boolean ? 'SÍ' : 'NO';
                        } else if (v.valor_json !== null && v.valor_json !== undefined) {
                            valor = JSON.stringify(v.valor_json);
                        }
                        
                        // Buscar el select correspondiente en el formulario principal para obtener el texto de la opción
                        // Esto asegura que se muestre el mismo valor que en el grid principal
                        const selectSelector = `.data-input[data-parametro-id="${parametroId}"][data-campo-id="${campoId}"][data-hora-index="${horaIndex}"]`;
                        const selectInput = document.querySelector(selectSelector);
                        
                        if (selectInput && selectInput.tagName === 'SELECT' && valor !== '' && valor !== '-') {
                            const opciones = Array.from(selectInput.options);
                            
                            // Para campos booleanos, buscar opción que comience con "Sí" o "No"
                            if (v.valor_boolean !== null) {
                                const opcionEncontrada = opciones.find(opt => {
                                    const texto = opt.value.toUpperCase();
                                    if (v.valor_boolean) {
                                        return texto.startsWith('SÍ') || texto.startsWith('SI');
                                    } else {
                                        return texto.startsWith('NO');
                                    }
                                });
                                if (opcionEncontrada) {
                                    valor = opcionEncontrada.textContent || opcionEncontrada.value;
                                    valorAsignado = true;
                                }
                            }
                            
                            // Si aún no se asignó, buscar coincidencia exacta
                            if (!valorAsignado) {
                                let opcionEncontrada = opciones.find(opt => opt.value === valor);
                                // Si no hay coincidencia exacta, buscar por coincidencia parcial
                                if (!opcionEncontrada) {
                                    opcionEncontrada = opciones.find(opt => 
                                        opt.value.includes(valor) || valor.includes(opt.value)
                                    );
                                }
                                if (opcionEncontrada) {
                                    // Usar el texto de la opción en lugar del valor
                                    valor = opcionEncontrada.textContent || opcionEncontrada.value;
                                    valorAsignado = true;
                                }
                            }
                        }
                        
                        // Asegurar que el valor no esté vacío
                        if (valor === '' || valor === null || valor === undefined) {
                            valor = '-';
                        }
                        
                        span.textContent = valor;
                    }
                });
            });
        }
        
        console.log('Formulario informativo actualizado con éxito.');
    } catch (error) {
        console.error('Error al actualizar formulario informativo:', error);
        // No mostrar mensaje de error al usuario, solo log
    }
}

// Guardar mediciones con envío anidado
async function guardarMediciones(formularioId) {
    const timeInputs = document.querySelectorAll('.time-input');
    const dataInputs = document.querySelectorAll('.data-input');
    const horas = Array.from(timeInputs).map(input => input.value);
    
    const medicionesMap = new Map();
    
    dataInputs.forEach(input => {
        const parametroId = input.getAttribute('data-parametro-id');
        const campoId = input.getAttribute('data-campo-id');
        const horaIndex = parseInt(input.getAttribute('data-hora-index'));
        const tipoValor = input.getAttribute('data-tipo-valor');
        const valor = input.value.trim();

        if (!valor || !parametroId || !horas[horaIndex]) return;
        
        const key = `${parametroId}-${horaIndex}`;
        if (!medicionesMap.has(key)) {
            medicionesMap.set(key, {
                formulario: formularioId,
                parametro: parseInt(parametroId),
                tomada_en: new Date(horas[horaIndex]).toISOString(),
                valores: []
            });
        }
        
        const payloadValor = { campo_id: parseInt(campoId) };
        if (tipoValor === 'number') {
            // Guardar todos los valores numéricos como texto en valor_text
            payloadValor.valor_text = valor;
        }
        else if (tipoValor === 'text') payloadValor.valor_text = valor;
        else if (tipoValor === 'boolean') {
            // Manejar valores booleanos que pueden ser "Sí", "SÍ", o valores que comienzan con "Sí" o "No"
            const valorUpper = valor.toUpperCase().trim();
            payloadValor.valor_boolean = valorUpper.startsWith('SÍ') || valorUpper.startsWith('SI');
        }
        
        medicionesMap.get(key).valores.push(payloadValor);
    });
    
    // Enviar todas las mediciones (cada una con sus valores anidados)
    const promesas = Array.from(medicionesMap.values()).map(data => 
        apiRequest('/mediciones/', 'POST', data)
    );
    
    await Promise.all(promesas);
    console.log('Todas las mediciones anidadas se han procesado.');
}

// Mostrar mensajes usando Toastify
function mostrarMensaje(mensaje, tipo = 'info') {
    let backgroundColor = "#3b82f6"; // Info (Blue)
    if (tipo === 'success') backgroundColor = "#10b981"; // Success (Green)
    if (tipo === 'error') backgroundColor = "#ef4444"; // Error (Red)
    if (tipo === 'warning') backgroundColor = "#f59e0b"; // Warning (Orange)

    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: mensaje,
            duration: 5000,
            close: true,
            gravity: "top", 
            position: "right", 
            stopOnFocus: true, 
            style: {
                background: backgroundColor,
                borderRadius: "8px",
                fontWeight: "500",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
            }
        }).showToast();
    } else {
        // Fallback si Toastify no carga
        console.log(`[${tipo.toUpperCase()}] ${mensaje}`);
    }
}

// Función para cambiar el texto del botón entre "Guardar" y "Actualizar"
function actualizarTextoBoton(esActualizacion) {
    const btnGuardar = document.getElementById('btn-guardar');
    if (btnGuardar) {
        if (esActualizacion) {
            btnGuardar.textContent = 'Actualizar Formulario';
            btnGuardar.setAttribute('data-es-actualizacion', 'true');
        } else {
            btnGuardar.textContent = 'Guardar Formulario';
            btnGuardar.removeAttribute('data-es-actualizacion');
        }
    }
}

// Función para buscar formularios existentes del paciente
async function buscarFormularioExistente(pacienteId, numIdentificacion) {
    try {
        // Buscar formularios por paciente o por num_identificacion
        let formularios = null;
        if (pacienteId) {
            formularios = await apiRequest(`/formularios/?paciente=${pacienteId}`);
        } else if (numIdentificacion) {
            formularios = await apiRequest(`/formularios/?paciente__num_identificacion=${numIdentificacion}`);
        }
        
        if (!formularios) return null;
        
        // DRF devuelve resultados paginados con formato {results: [...]}
        const listaFormularios = formularios?.results || formularios || [];
        
        if (listaFormularios.length > 0) {
            // Retornar el formulario más reciente
            return listaFormularios[0];
        }
        return null;
    } catch (error) {
        console.error('Error al buscar formulario existente:', error);
        return null;
    }
}

// Función para bloquear/desbloquear una columna completa
function bloquearColumna(horaIndex, bloquear = true) {
    // Bloquear todos los inputs de datos de esa columna
    const dataInputs = document.querySelectorAll(`.data-input[data-hora-index="${horaIndex}"]`);
    dataInputs.forEach(input => {
        if (bloquear) {
            input.disabled = true;
            input.readOnly = true;
            input.style.backgroundColor = '#f0f0f0';
            input.style.cursor = 'not-allowed';
            input.setAttribute('data-bloqueado', 'true');
        } else {
            input.disabled = false;
            input.readOnly = false;
            input.style.backgroundColor = '';
            input.style.cursor = '';
            input.removeAttribute('data-bloqueado');
        }
    });
    
    // Bloquear el input de tiempo de esa columna
    const timeInput = document.querySelector(`.time-input[data-hora-index="${horaIndex}"]`);
    if (timeInput) {
        if (bloquear) {
            timeInput.disabled = true;
            timeInput.readOnly = true;
            timeInput.style.backgroundColor = '#f0f0f0';
            timeInput.style.cursor = 'not-allowed';
            timeInput.setAttribute('data-bloqueado', 'true');
        } else {
            timeInput.disabled = false;
            timeInput.readOnly = false;
            timeInput.style.backgroundColor = '';
            timeInput.style.cursor = '';
            timeInput.removeAttribute('data-bloqueado');
        }
    }
}

// Función para desbloquear todas las columnas
function desbloquearTodasLasColumnas() {
    const timeInputs = document.querySelectorAll('.time-input');
    timeInputs.forEach((input, index) => {
        bloquearColumna(index, false);
    });
}

// Limpiar todos los campos del formulario y el grid
function limpiarFormulario() {
    console.log('🧹 Limpiando campos del formulario...');
    
    // IDs de campos a limpiar (excluyendo el de búsqueda si se desea)
    const camposALimpiar = [
        'paciente_id', 'formulario_id', 'num_historia_clinica', 
        'nombres', 'tipo_sangre', 'fecha_elabora_paciente', 
        'diagnostico', 'edad_snapshot', 'edad_gestion', 
        'n_controles_prenatales', 'responsable', 'aseguradora_id'
    ];

    camposALimpiar.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    // Restablecer fecha actual en fecha_elabora_paciente después de limpiar
    const fechaElaboraPaciente = document.getElementById('fecha_elabora_paciente');
    if (fechaElaboraPaciente) {
        const hoy = obtenerFechaLocalColombia();
        fechaElaboraPaciente.value = hoy;
    }

    // Desbloquear todas las columnas antes de limpiar
    desbloquearTodasLasColumnas();

    // Limpiar el grid de datos
    document.querySelectorAll('.data-input').forEach(input => {
        input.value = '';
        input.disabled = false;
        input.readOnly = false;
        input.style.backgroundColor = '';
        input.style.cursor = '';
    });
    
    // Limpiar los inputs de tiempo
    document.querySelectorAll('.time-input').forEach(input => {
        input.value = '';
        input.disabled = false;
        input.readOnly = false;
        input.style.backgroundColor = '';
        input.style.cursor = '';
    });
    
    // Restablecer el botón a "Guardar"
    actualizarTextoBoton(false);
}

// Función para obtener la fecha local de Colombia (UTC-5) en formato YYYY-MM-DD
// Esta función usa la zona horaria local del navegador en lugar de UTC
function obtenerFechaLocalColombia() {
    const ahora = new Date();
    // Obtener la fecha local considerando la zona horaria del navegador
    // Esto evita problemas cuando el servidor está en UTC y el cliente en otra zona horaria
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
}

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, inicializando aplicación...');
    
    // Cargar aseguradoras al iniciar
    cargarAseguradoras();
    
    // Asegurar que los campos de fecha del grid estén vacíos (sin valores por defecto)
    document.querySelectorAll('.time-input').forEach(input => {
        input.value = '';
    });
    
    // Establecer fecha actual por defecto
    const hoy = obtenerFechaLocalColombia();
    const fechaElabora = document.getElementById('fecha_elabora');
    if (fechaElabora && !fechaElabora.value) {
        fechaElabora.value = hoy;
    }
    
    // Establecer fecha actual por defecto en fecha_elabora_paciente
    const fechaElaboraPaciente = document.getElementById('fecha_elabora_paciente');
    if (fechaElaboraPaciente) {
        fechaElaboraPaciente.value = hoy;
    }

    // Recalcular edad cuando cambie la fecha de nacimiento (fecha_elabora_paciente)
    const fechaNacimientoInput = document.getElementById('fecha_elabora_paciente');
    const edadInput = document.getElementById('edad_snapshot');
    if (fechaNacimientoInput && edadInput) {
        fechaNacimientoInput.addEventListener('change', function() {
            if (this.value) {
                edadInput.value = calcularEdad(this.value);
                console.log(`🎂 Edad recalculada manualmente: ${edadInput.value}`);
            }
        });
    }
    
    // Búsqueda de paciente por número de identificación con botón
    const btnBuscarPacienteCedula = document.getElementById('btn-buscar-paciente-cedula');
    const numIdentificacionInput = document.getElementById('num_identificacion');
    
    if (btnBuscarPacienteCedula && numIdentificacionInput) {
        btnBuscarPacienteCedula.addEventListener('click', async function() {
            const cedula = numIdentificacionInput.value.trim();
            if (!cedula) {
                mostrarMensaje('Por favor ingrese un número de identificación', 'error');
                return;
            }
            
            // Deshabilitar el botón mientras se busca
            btnBuscarPacienteCedula.disabled = true;
            btnBuscarPacienteCedula.textContent = 'Buscando...';
            
            // Limpiar el formulario antes de la nueva búsqueda
            limpiarFormulario();
            // Restaurar el valor de búsqueda
            numIdentificacionInput.value = cedula;
            
            console.log(`Iniciando petición de búsqueda para identificación: ${cedula}`);
            try {
                const pacientes = await apiRequest(`/pacientes/?num_identificacion=${cedula}`);
                console.log('Respuesta de búsqueda por identificación:', pacientes);
                
                if (pacientes && pacientes.length > 0) {
                    const paciente = pacientes[0];
                    console.log('Paciente cargado:', paciente);
                    
                    // Guardar el ID del paciente en un campo oculto
                    let pacienteIdField = document.getElementById('paciente_id');
                    if (!pacienteIdField) {
                        pacienteIdField = document.createElement('input');
                        pacienteIdField.type = 'hidden';
                        pacienteIdField.id = 'paciente_id';
                        pacienteIdField.name = 'paciente_id';
                        document.getElementById('formulario-clinico').appendChild(pacienteIdField);
                    }
                    pacienteIdField.value = paciente.id;
                    
                    // Completar campos del formulario
                    if (document.getElementById('num_historia_clinica')) {
                        document.getElementById('num_historia_clinica').value = paciente.num_historia_clinica || '';
                    }
                    if (document.getElementById('nombres')) {
                        document.getElementById('nombres').value = paciente.nombres || '';
                    }
                    if (document.getElementById('tipo_sangre')) {
                        document.getElementById('tipo_sangre').value = paciente.tipo_sangre || '';
                    }
                    const fechaElaboraPaciente = document.getElementById('fecha_elabora_paciente');
                    if (fechaElaboraPaciente) {
                        const hoy = obtenerFechaLocalColombia();
                        fechaElaboraPaciente.value = paciente.fecha_nacimiento || hoy;
                    }
                    if (document.getElementById('edad_snapshot') && paciente.fecha_nacimiento) {
                        const edad = calcularEdad(paciente.fecha_nacimiento);
                        document.getElementById('edad_snapshot').value = edad;
                    }
                    
                    // Buscar formulario existente para este paciente
                    const formularioExistente = await buscarFormularioExistente(paciente.id, cedula);
                    if (formularioExistente) {
                        console.log('Formulario existente encontrado:', formularioExistente);
                        document.getElementById('formulario_id').value = formularioExistente.id;
                        // Cargar datos del formulario
                        await cargarMedicionesEnGrid(formularioExistente.id);
                        // Actualizar el formulario informativo con los datos cargados
                        await actualizarFormularioInformativo(formularioExistente.id);
                        // Cambiar botón a "Actualizar"
                        actualizarTextoBoton(true);
                        mostrarMensaje('Datos encontrados', 'success');
                    } else {
                        // No hay formulario, mantener botón en "Guardar"
                        actualizarTextoBoton(false);
                        mostrarMensaje('Paciente encontrado', 'success');
                    }
                    
                    console.log(`Paciente encontrado:`, paciente);
                } else {
                    mostrarMensaje('Paciente no encontrado', 'info');
                    console.log('No se encontró paciente con ese número de identificación');
                    
                    // Limpiar formulario excepto el campo de búsqueda
                    limpiarFormulario();
                    document.getElementById('num_identificacion').value = cedula;
                }
            } catch (error) {
                console.error('Error al buscar paciente:', error);
                mostrarMensaje('Error al buscar paciente: ' + error.message, 'error');
            } finally {
                // Rehabilitar el botón
                btnBuscarPacienteCedula.disabled = false;
                btnBuscarPacienteCedula.textContent = 'Buscar';
            }
        });
        
        // También permitir búsqueda con Enter en el campo
        numIdentificacionInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnBuscarPacienteCedula.click();
            }
        });
    }
    
    // Búsqueda automática de paciente por número de identificación (al perder foco)
    if (numIdentificacionInput) {
        numIdentificacionInput.addEventListener('blur', async function() {
            const cedula = this.value.trim();
            if (!cedula) return;
            
            // Limpiar formulario antes de la búsqueda automática
            // pero mantenemos el valor del input que lanzó el blur
            const currentCedula = this.value;
            limpiarFormulario();
            this.value = currentCedula;
            
            console.log(`Iniciando petición de búsqueda para identificación: ${cedula}`);
            try {
                const pacientes = await apiRequest(`/pacientes/?num_identificacion=${cedula}`);
                console.log('Respuesta de búsqueda por identificación:', pacientes);
                
                if (pacientes && pacientes.length > 0) {
                    const paciente = pacientes[0];
                    console.log('Paciente cargado:', paciente);
                    
                    // Guardar el ID del paciente en un campo oculto
                    let pacienteIdField = document.getElementById('paciente_id');
                    if (!pacienteIdField) {
                        pacienteIdField = document.createElement('input');
                        pacienteIdField.type = 'hidden';
                        pacienteIdField.id = 'paciente_id';
                        pacienteIdField.name = 'paciente_id';
                        document.getElementById('formulario-clinico').appendChild(pacienteIdField);
                    }
                    pacienteIdField.value = paciente.id;
                    
                    // Completar campos del formulario
                    if (document.getElementById('num_historia_clinica')) {
                        document.getElementById('num_historia_clinica').value = paciente.num_historia_clinica || '';
                    }
                    if (document.getElementById('nombres')) {
                        document.getElementById('nombres').value = paciente.nombres || '';
                    }
                    if (document.getElementById('tipo_sangre')) {
                        document.getElementById('tipo_sangre').value = paciente.tipo_sangre || '';
                    }
                    const fechaElaboraPaciente = document.getElementById('fecha_elabora_paciente');
                    if (fechaElaboraPaciente) {
                        const hoy = obtenerFechaLocalColombia();
                        fechaElaboraPaciente.value = paciente.fecha_nacimiento || hoy;
                    }
                    if (document.getElementById('edad_snapshot') && paciente.fecha_nacimiento) {
                        const edad = calcularEdad(paciente.fecha_nacimiento);
                        document.getElementById('edad_snapshot').value = edad;
                    }
                    
                    // Buscar formulario existente para este paciente
                    const formularioExistente = await buscarFormularioExistente(paciente.id, cedula);
                    if (formularioExistente) {
                        console.log('Formulario existente encontrado:', formularioExistente);
                        document.getElementById('formulario_id').value = formularioExistente.id;
                        // Cargar datos del formulario
                        await cargarMedicionesEnGrid(formularioExistente.id);
                        // Actualizar el formulario informativo con los datos cargados
                        await actualizarFormularioInformativo(formularioExistente.id);
                        // Cambiar botón a "Actualizar"
                        actualizarTextoBoton(true);
                        mostrarMensaje('Datos encontrados', 'info');
                    } else {
                        // No hay formulario, mantener botón en "Guardar"
                        actualizarTextoBoton(false);
                    }
                    
                    console.log(`Paciente encontrado: ${paciente.nombres}`);
                } else {
                    console.log('No se encontró paciente con ese número de identificación');
                    // Limpiar formulario excepto el campo de búsqueda
                    limpiarFormulario();
                    document.getElementById('num_identificacion').value = cedula;
                }
            } catch (error) {
                console.error('Error al buscar paciente:', error);
            }
        });
    }
    
    // Event listeners
    const btnBuscarPacienteOld = document.getElementById('btn-buscar-paciente');
    if (btnBuscarPacienteOld) {
        btnBuscarPacienteOld.addEventListener('click', buscarPaciente);
    }
    
    const formulario = document.getElementById('formulario-clinico');
    if (formulario) {
        console.log('Formulario encontrado, registrando event listener para submit...');
        
        formulario.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Submit del formulario detectado, iniciando guardado...');
            
            // Deshabilitar el botón para evitar doble envío
            const btnGuardar = document.getElementById('btn-guardar');
            if (btnGuardar) {
                btnGuardar.disabled = true;
                btnGuardar.textContent = 'Guardando...';
            }
            
            try {
                await guardarFormulario();
                console.log('Formulario guardado exitosamente');
            } catch (error) {
                console.error('Error en guardarFormulario:', error);
                mostrarMensaje('Error al guardar formulario', 'error');
            } finally {
                // Rehabilitar el botón y restaurar texto según si es actualización
                if (btnGuardar) {
                    btnGuardar.disabled = false;
                    const formularioId = document.getElementById('formulario_id').value;
                    if (formularioId) {
                        btnGuardar.textContent = 'Actualizar Formulario';
                    } else {
                        btnGuardar.textContent = 'Guardar Formulario';
                    }
                }
            }
        });
        
        console.log('Event listener registrado correctamente');
    } else {
        console.error('ERROR: No se encontró el formulario con id "formulario-clinico"');
    }
    
    // Listener directo al botón como respaldo
    const btnGuardar = document.getElementById('btn-guardar');
    if (btnGuardar) {
        console.log('Botón de guardar encontrado, agregando listener directo...');
        btnGuardar.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Click en botón Guardar detectado');
            
            // Deshabilitar el botón
            btnGuardar.disabled = true;
            btnGuardar.textContent = 'Guardando...';
            
            try {
                await guardarFormulario();
                console.log('Formulario guardado exitosamente desde botón');
            } catch (error) {
                console.error('Error al guardar desde botón:', error);
                mostrarMensaje('Error al guardar formulario', 'error');
            } finally {
                // Rehabilitar el botón y restaurar texto según si es actualización
                btnGuardar.disabled = false;
                const formularioId = document.getElementById('formulario_id').value;
                if (formularioId) {
                    btnGuardar.textContent = 'Actualizar Formulario';
                } else {
                    btnGuardar.textContent = 'Guardar Formulario';
                }
            }
        });
    } else {
        console.error('ERROR: No se encontró el botón con id "btn-guardar"');
    }
    
    // Función compartida para buscar por documento
    async function buscarPorDocumento(documento) {
        if (!documento) {
            mostrarMensaje("Ingrese el documento del paciente", "error");
            return;
        }

        // Limpiar formulario antes de buscar
        limpiarFormulario();
        // Restaurar el valor del documento buscado
        const documentoInput = document.getElementById('documento');
        if (documentoInput) {
            documentoInput.value = documento;
        }

        try {
            // Buscar formulario por num_identificacion del paciente usando el filtro de DRF
            // La búsqueda se hace en la tabla formulario filtrando por paciente__num_identificacion
            const formularios = await apiRequest(`/formularios/?paciente__num_identificacion=${documento}`);
            console.log('Formularios encontrados para el documento:', formularios);
            
            // DRF devuelve resultados paginados con formato {results: [...]}
            const listaFormularios = formularios?.results || formularios || [];
            
            if (listaFormularios.length > 0) {
                // Tomar el formulario más reciente (ya está ordenado por fecha_actualizacion descendente)
                const formulario = listaFormularios[0];
                const paciente = formulario.paciente;
                
                console.log("Formulario seleccionado:", formulario);
                console.log("Paciente asociado al formulario:", paciente);
                
                // Llenar campos del paciente
                if (document.getElementById('paciente_id')) {
                    document.getElementById('paciente_id').value = paciente.id;
                }
                if (document.getElementById('formulario_id')) {
                    document.getElementById('formulario_id').value = formulario.id;
                }
                if (document.getElementById('num_historia_clinica')) {
                    document.getElementById('num_historia_clinica').value = paciente.num_historia_clinica || '';
                }
                if (document.getElementById('num_identificacion')) {
                    document.getElementById('num_identificacion').value = paciente.num_identificacion || '';
                }
                if (document.getElementById('nombres')) {
                    document.getElementById('nombres').value = paciente.nombres || '';
                }
                if (document.getElementById('tipo_sangre') && paciente.tipo_sangre) {
                    document.getElementById('tipo_sangre').value = paciente.tipo_sangre || '';
                }
                const fechaElaboraPaciente = document.getElementById('fecha_elabora_paciente');
                if (fechaElaboraPaciente) {
                    const hoy = obtenerFechaLocalColombia();
                    // Priorizar fecha de nacimiento del paciente, luego fecha del formulario, finalmente fecha actual
                    fechaElaboraPaciente.value = paciente.fecha_nacimiento || formulario.fecha_elabora || hoy;
                }
                
                // Llenar campos del formulario
                if (document.getElementById('codigo')) {
                    document.getElementById('codigo').value = formulario.codigo || '';
                }
                if (document.getElementById('num_hoja')) {
                    document.getElementById('num_hoja').value = formulario.num_hoja || '';
                }
                if (document.getElementById('estado')) {
                    document.getElementById('estado').value = formulario.estado || '';
                }
                if (document.getElementById('diagnostico')) {
                    document.getElementById('diagnostico').value = formulario.diagnostico || '';
                }
                if (document.getElementById('edad_snapshot')) {
                    document.getElementById('edad_snapshot').value = formulario.edad_snapshot || '';
                }
                if (document.getElementById('edad_gestion')) {
                    document.getElementById('edad_gestion').value = formulario.edad_gestion || '';
                }
                if (document.getElementById('n_controles_prenatales')) {
                    document.getElementById('n_controles_prenatales').value = formulario.n_controles_prenatales || '';
                }
                if (document.getElementById('responsable')) {
                    document.getElementById('responsable').value = formulario.responsable || '';
                }
                if (document.getElementById('aseguradora_id') && formulario.aseguradora) {
                    document.getElementById('aseguradora_id').value = formulario.aseguradora.id || '';
                }
                
                // Calcular la edad usando la fecha de nacimiento del paciente
                if (document.getElementById('edad_snapshot') && paciente.fecha_nacimiento) {
                    document.getElementById('edad_snapshot').value = calcularEdad(paciente.fecha_nacimiento);
                }
                
                // Cargar las mediciones en el grid
                await cargarMedicionesEnGrid(formulario.id);
                
                // Actualizar el formulario informativo con los datos cargados
                await actualizarFormularioInformativo(formulario.id);
                
                // Cambiar botón a "Actualizar" ya que se encontró un formulario
                actualizarTextoBoton(true);
                
                mostrarMensaje('Datos encontrados', "success");
            } else {
                // Buscar solo el paciente si no hay formulario
                const pacientes = await apiRequest(`/pacientes/?num_identificacion=${documento}`);
                if (pacientes && pacientes.length > 0) {
                    const paciente = pacientes[0];
                    if (document.getElementById('paciente_id')) {
                        document.getElementById('paciente_id').value = paciente.id;
                    }
                    if (document.getElementById('num_historia_clinica')) {
                        document.getElementById('num_historia_clinica').value = paciente.num_historia_clinica || '';
                    }
                    if (document.getElementById('num_identificacion')) {
                        document.getElementById('num_identificacion').value = paciente.num_identificacion || '';
                    }
                    if (document.getElementById('nombres')) {
                        document.getElementById('nombres').value = paciente.nombres || '';
                    }
                    if (document.getElementById('tipo_sangre')) {
                        document.getElementById('tipo_sangre').value = paciente.tipo_sangre || '';
                    }
                    const fechaElaboraPaciente = document.getElementById('fecha_elabora_paciente');
                    if (fechaElaboraPaciente) {
                        const hoy = obtenerFechaLocalColombia();
                        fechaElaboraPaciente.value = paciente.fecha_nacimiento || hoy;
                    }
                    if (document.getElementById('edad_snapshot') && paciente.fecha_nacimiento) {
                        const edad = calcularEdad(paciente.fecha_nacimiento);
                        document.getElementById('edad_snapshot').value = edad;
                    }
                    // Mantener botón en "Guardar" ya que no hay formulario
                    actualizarTextoBoton(false);
                    mostrarMensaje("Paciente encontrado. No se encontró formulario existente. Puede crear uno nuevo.", "info");
                } else {
                    mostrarMensaje("No se encontró ningún formulario ni paciente para este documento. Puede crear uno nuevo.", "info");
                    // Limpiar formulario excepto el campo de búsqueda de documento
                    limpiarFormulario();
                    if (documentoInput) {
                        documentoInput.value = documento;
                    }
                }
            }
        } catch (error) {
            console.error("Error al buscar formulario:", error);
            mostrarMensaje("Error al buscar datos", "error");
        }
    }

    // Event listener para buscar paciente por documento
    const btnBuscarPaciente = document.getElementById("btnBuscarPaciente");
    if (btnBuscarPaciente) {
        btnBuscarPaciente.addEventListener("click", async function () {
            const documento = document.getElementById("documento").value;
            await buscarPorDocumento(documento);
        });
    }
    
    // Búsqueda automática cuando se ingresa documento (al perder foco)
    const documentoInput = document.getElementById("documento");
    if (documentoInput) {
        documentoInput.addEventListener('blur', async function() {
            const documento = this.value.trim();
            if (!documento) return;
            await buscarPorDocumento(documento);
        });
        
        // También permitir búsqueda con Enter
        documentoInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                buscarPorDocumento(this.value.trim());
            }
        });
    }
    
    // Función para cargar mediciones guardadas en el grid
    async function cargarMedicionesEnGrid(formularioId) {
        try {
            console.log(`Cargando mediciones para el formulario ${formularioId}...`);
            const mediciones = await apiRequest(`/formularios/${formularioId}/mediciones/`);
            console.log('Mediciones recibidas:', mediciones);

            if (!mediciones || mediciones.length === 0) {
                console.log('No hay mediciones guardadas para este formulario.');
                return;
            }

            // 1. Identificar todas las horas únicas y ordenarlas
            const horasUnicas = [...new Set(mediciones.map(m => m.tomada_en))].sort();
            console.log('Horas detectadas:', horasUnicas);

            // 2. Llenar los inputs de tiempo (encabezado del grid)
            const timeInputs = document.querySelectorAll('.time-input');
            const horaToIndexMap = {};
            const columnasConDatos = new Set(); // Para rastrear qué columnas tienen datos

            horasUnicas.forEach((hora, index) => {
                if (index < timeInputs.length) {
                    // Convertir a formato local para datetime-local input (YYYY-MM-DDTHH:MM)
                    const date = new Date(hora);
                    const localISO = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
                                        .toISOString().slice(0, 16);
                    
                    timeInputs[index].value = localISO;
                    horaToIndexMap[hora] = index;
                }
            });

            // 3. Limpiar grid antes de cargar (opcional, pero recomendado)
            document.querySelectorAll('.data-input').forEach(input => input.value = '');

            // 4. Llenar los valores en las celdas y rastrear columnas con datos
            mediciones.forEach(medicion => {
                const horaIndex = horaToIndexMap[medicion.tomada_en];
                if (horaIndex === undefined) return; // Superó las 12 columnas

                // Usamos el ID del parámetro desde el objeto anidado (parametro.id)
                const parametroId = medicion.parametro ? medicion.parametro.id : null;
                if (!parametroId) return;

                medicion.valores.forEach(v => {
                    // Usamos el ID del campo desde el objeto anidado (v.campo.id)
                    const campoId = v.campo ? v.campo.id : null;
                    if (!campoId) return;

                    const selector = `.data-input[data-parametro-id="${parametroId}"][data-campo-id="${campoId}"][data-hora-index="${horaIndex}"]`;
                    const input = document.querySelector(selector);
                    
                    if (input) {
                        // Obtener el valor no nulo y formatearlo
                        // Priorizar valor_text sobre valor_number (para compatibilidad con datos antiguos)
                        let valor = '';
                        let valorAsignado = false;
                        
                        if (v.valor_text !== null && v.valor_text !== undefined) {
                            valor = v.valor_text;
                        } else if (v.valor_number !== null && v.valor_number !== undefined) {
                            // Compatibilidad con datos antiguos que puedan estar en valor_number
                            valor = parseFloat(v.valor_number);
                            if (Number.isInteger(valor)) valor = parseInt(valor);
                            valor = valor.toString();
                        } else if (v.valor_boolean !== null) {
                            // Para campos booleanos, convertir a texto
                            valor = v.valor_boolean ? 'SÍ' : 'NO';
                        } else if (v.valor_json !== null) {
                            valor = JSON.stringify(v.valor_json);
                        }
                        
                        // Si es un select, buscar la opción que coincida
                        if (input.tagName === 'SELECT' && valor !== '') {
                            const opciones = Array.from(input.options);
                            
                            // Para campos booleanos, buscar opción que comience con "Sí" o "No"
                            if (v.valor_boolean !== null) {
                                const opcionEncontrada = opciones.find(opt => {
                                    const texto = opt.value.toUpperCase();
                                    if (v.valor_boolean) {
                                        return texto.startsWith('SÍ') || texto.startsWith('SI');
                                    } else {
                                        return texto.startsWith('NO');
                                    }
                                });
                                if (opcionEncontrada) {
                                    input.value = opcionEncontrada.value;
                                    valorAsignado = true;
                                }
                            }
                            
                            // Si aún no se asignó, buscar coincidencia exacta
                            if (!valorAsignado) {
                                let opcionEncontrada = opciones.find(opt => opt.value === valor);
                                // Si no hay coincidencia exacta, buscar por coincidencia parcial
                                if (!opcionEncontrada) {
                                    opcionEncontrada = opciones.find(opt => 
                                        opt.value.includes(valor) || valor.includes(opt.value)
                                    );
                                }
                                if (opcionEncontrada) {
                                    input.value = opcionEncontrada.value;
                                    valorAsignado = true;
                                }
                            }
                            
                            // Si no se encuentra ninguna opción, asignar el valor directamente
                            if (!valorAsignado) {
                                input.value = valor;
                            }
                        } else {
                            // Para inputs normales, asignar el valor directamente
                            input.value = valor;
                        }
                        
                        // Si el valor no está vacío, marcar esta columna como con datos
                        if (valor !== '' && valor !== null && valor !== undefined) {
                            columnasConDatos.add(horaIndex);
                        }
                    }
                });
            });

            // 5. Bloquear todas las columnas que tienen al menos un dato
            columnasConDatos.forEach(horaIndex => {
                bloquearColumna(horaIndex, true);
                console.log(`Columna ${horaIndex} bloqueada (tiene datos)`);
            });

            console.log('Grid poblado con éxito. Columnas con datos bloqueadas:', Array.from(columnasConDatos));
        } catch (error) {
            console.error('Error al cargar mediciones en el grid:', error);
            mostrarMensaje('Error al cargar mediciones guardadas', 'error');
        }
    }
    
    // Función para descargar PDF
    // Ahora utiliza la nueva vista de impresión HTML optimizada
    function descargarPDF(pacienteId, formularioId) {
        console.log('Preparando vista de impresión...');
        
        // 1) Intentar usar el ID de formulario desde el campo oculto
        const formularioIdEl = document.getElementById('formulario_id');
        if (!formularioId && formularioIdEl && formularioIdEl.value) {
            formularioId = formularioIdEl.value;
        }

        if (formularioId) {
            console.log(`Abriendo vista de impresión para Formulario ID: ${formularioId}`);
            // Abrimos la nueva vista HTML que lanzará el diálogo de impresión automáticamente
            window.open(`/formulario/${formularioId}/impresion/`, '_blank');
            return;
        }

        // 2) Fallback para paciente si no hay formulario
        const pacienteIdEl = document.getElementById('paciente_id');
        if (!pacienteId && pacienteIdEl && pacienteIdEl.value) {
            pacienteId = pacienteIdEl.value;
        }

        if (pacienteId) {
            console.log(`Generando PDF genérico para Paciente ID: ${pacienteId}`);
            window.open(`/pacientes/${pacienteId}/pdf/`, '_blank');
        } else {
            mostrarMensaje('Busque un paciente o formulario para imprimir', 'error');
        }
    }

    // Hacer la función disponible globalmente para el botón del HTML
    window.descargarPDF = descargarPDF;

    console.log('Inicialización finalizada correctamente');
});

