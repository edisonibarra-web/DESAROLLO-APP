// Configuración de la API
const API_BASE_URL = '/api';

// Utilidades
function getCSRFToken() {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
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

    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`🌐 Haciendo petición ${method} a: ${url}`);
    if (data) {
        console.log('📤 Datos enviados:', data);
    }
    
    const response = await fetch(url, options);
    
    console.log(`📥 Respuesta recibida: ${response.status} ${response.statusText}`);

    if (response.ok) {
        // Log exitoso para respuestas 200 OK
        console.log(`✅ Petición exitosa: ${method} ${url} - Status: ${response.status}`);
    }

    if (!response.ok) {
        const text = await response.text();
        console.error(`❌ Error en la respuesta:`, {
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
        
        // Mostrar alerta al usuario
        let alertMessage = `Error ${response.status}: ${response.statusText}\n\n`;
        
        // Mensajes específicos según el tipo de error
        if (errorDetails.num_identificacion) {
            const numId = data?.num_identificacion || document.getElementById('num_identificacion')?.value || '';
            alertMessage = `⚠️ ERROR: El número de identificación "${numId}" ya está registrado.\n\nPor favor, use un número de identificación diferente o busque el paciente existente.`;
        } else if (errorDetails.num_historia_clinica) {
            const numHist = data?.num_historia_clinica || document.getElementById('num_historia_clinica')?.value || '';
            alertMessage = `⚠️ ERROR: El número de historia clínica "${numHist}" ya está registrado.\n\nPor favor, use un número de historia clínica diferente.`;
        } else if (errorDetails.non_field_errors) {
            const uniqueError = errorDetails.non_field_errors.find(e => e.includes('unique'));
            if (uniqueError) {
                alertMessage = `⚠️ ERROR: ${uniqueError}\n\nPor favor, cambie los valores duplicados.`;
            } else {
                alertMessage += errorMessage;
            }
        } else {
            alertMessage += errorMessage;
        }
        
        alert(alertMessage);
        
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
    const numIdentificacion = document.getElementById('num_identificacion').value;
    const numHistoriaClinica = document.getElementById('num_historia_clinica').value;
    
    if (!numIdentificacion && !numHistoriaClinica) {
        mostrarMensaje('Ingrese número de identificación o historia clínica', 'error');
        return;
    }
    
    try {
        const pacientes = await apiRequest('/pacientes/');
        let paciente = null;
        
        if (numIdentificacion) {
            paciente = pacientes.find(p => p.num_identificacion === numIdentificacion);
        } else if (numHistoriaClinica) {
            paciente = pacientes.find(p => p.num_historia_clinica === numHistoriaClinica);
        }
        
        if (paciente) {
            // Llenar campos del paciente
            document.getElementById('paciente_id').value = paciente.id;
            document.getElementById('num_historia_clinica').value = paciente.num_historia_clinica;
            document.getElementById('num_identificacion').value = paciente.num_identificacion;
            document.getElementById('nombres').value = paciente.nombres;
            if (paciente.tipo_sangre) {
                document.getElementById('tipo_sangre').value = paciente.tipo_sangre;
            }
            if (paciente.fecha_nacimiento) {
                document.getElementById('fecha_elabora_paciente').value = paciente.fecha_nacimiento;
            }
            
            mostrarMensaje('Paciente encontrado ', 'success');
        } else {
            mostrarMensaje('Paciente no encontrado. Puede crear uno nuevo.', 'info');
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
        console.error('❌ Error al guardar paciente:', error);
        console.error('Detalles del error:', {
            message: error.message,
            stack: error.stack
        });
        
        // Mostrar mensaje más descriptivo
        let mensajeError = 'Error al guardar paciente: ';
        let alertMessage = '';
        
        if (error.message.includes('num_historia_clinica') || error.message.includes('historia clínica')) {
            mensajeError += 'El número de historia clínica ya existe o es inválido.';
            alertMessage = '⚠️ ERROR: El número de historia clínica ya está registrado.\n\nPor favor, use un número diferente o busque el paciente existente.';
        } else if (error.message.includes('num_identificacion') || error.message.includes('identificación')) {
            mensajeError += 'El número de identificación ya existe o es inválido.';
            alertMessage = '⚠️ ERROR: El número de identificación ya está registrado.\n\nPor favor, use un número diferente o busque el paciente existente.';
        } else {
            mensajeError += error.message;
            alertMessage = `⚠️ ERROR al guardar paciente:\n\n${error.message}`;
        }
        
        // Mostrar alerta
        alert(alertMessage);
        mostrarMensaje(mensajeError, 'error');
        throw error;
    }
}

// Guardar formulario
async function guardarFormulario() {
    console.log('Iniciando guardarFormulario...');
    try {
        console.log('Guardando paciente...');
        // Primero guardar/actualizar paciente
        await guardarPaciente();
        
        const pacienteId = document.getElementById('paciente_id').value;
        console.log('Paciente ID después de guardar:', pacienteId);
        if (!pacienteId) {
            console.error('No se pudo obtener el ID del paciente');
            mostrarMensaje('Debe guardar el paciente primero. Verifique que los campos de paciente estén completos.', 'error');
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
            fecha_elabora: document.getElementById('fecha_elabora')?.value || new Date().toISOString().split('T')[0],
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
        
        const formularioId = document.getElementById('formulario_id').value;
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
        
        mostrarMensaje('Formulario guardado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error al guardar formulario:', error);
        
        // Mensaje de alerta más claro
        let alertMessage = '⚠️ ERROR al guardar formulario:\n\n';
        
        if (error.message.includes('num_identificacion') || error.message.includes('identificación')) {
            alertMessage += 'El número de identificación del paciente ya está registrado.\n\nPor favor, use un número diferente o busque el paciente existente.';
        } else if (error.message.includes('unique') || error.message.includes('codigo, version, num_hoja')) {
            alertMessage += 'Ya existe un formulario con estos valores (código, versión, hoja).\n\nPor favor, cambie alguno de estos valores.';
        } else if (error.message.includes('Campos requeridos')) {
            alertMessage += error.message;
        } else {
            alertMessage += error.message;
        }
        
        alert(alertMessage);
        mostrarMensaje('Error al guardar formulario: ' + error.message, 'error');
    }
}

// Guardar mediciones
async function guardarMediciones(formularioId) {
    const timeInputs = document.querySelectorAll('.time-input');
    const dataInputs = document.querySelectorAll('.data-input');
    
    // Obtener horas de los inputs de tiempo
    const horas = Array.from(timeInputs).map(input => input.value);
    
    // Agrupar mediciones por parámetro y hora
    const medicionesMap = new Map();
    
    dataInputs.forEach(input => {
        const parametroId = input.getAttribute('data-parametro-id');
        const horaIndex = parseInt(input.getAttribute('data-hora-index'));
        const tipoValor = input.getAttribute('data-tipo-valor');
        const valor = input.value.trim();

        const fecha = horas[horaIndex];
        const fechaISO = fecha ? new Date(fecha).toISOString() : null;

        if (!valor || !parametroId || horaIndex === null || !horas[horaIndex]) {
            return;
        }
        
        const key = `${parametroId}-${horaIndex}`;
        if (!medicionesMap.has(key)) {
            medicionesMap.set(key, {
                formulario: formularioId,
                parametro: parametroId,
                tomada_en: horas[horaIndex],
                observacion: null,
                valores: []
            });
        }
        
        const medicion = medicionesMap.get(key);
        medicion.valores.push({
            campo_codigo: input.getAttribute('data-campo-codigo'), // ✅
            tipo_valor: tipoValor,
            valor: tipoValor === 'number' ? parseFloat(valor) : valor
        });
    });
    
    // Guardar cada medición
    for (const [key, medicionData] of medicionesMap) {
        try {
            // Crear la medición
            const medicion = await apiRequest('/mediciones/', 'POST', {
                formulario: medicionData.formulario,
                parametro: medicionData.parametro,
                tomada_en: fechaISO,
                observacion: medicionData.observacion
            });
            
            // Guardar valores de la medición
            for (const valorData of medicionData.valores) {
                const valorPayload = {
                     campo_id: valorData.campo_id,
                    [valorData.tipo_valor === 'number' ? 'valor_number' : 
                      valorData.tipo_valor === 'text' ? 'valor_text' :
                      valorData.tipo_valor === 'boolean' ? 'valor_boolean' : 'valor_json']: valorData.valor
                };
                
                await apiRequest(`/mediciones/${medicion.id}/valores/`, 'POST', valorPayload);
            }
        } catch (error) {
            console.error(`Error al guardar medición ${key}:`, error);
        }
    }
}

// Mostrar mensajes
function mostrarMensaje(mensaje, tipo = 'info') {
    // Remover mensajes anteriores
    const mensajesAnteriores = document.querySelectorAll('.message');
    mensajesAnteriores.forEach(msg => msg.remove());
    
    // Crear nuevo mensaje
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = `message message-${tipo}`;
    mensajeDiv.textContent = mensaje;
    
    // Insertar al inicio del formulario
    const form = document.getElementById('formulario-clinico');
    if (form) {
        form.insertBefore(mensajeDiv, form.firstChild);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            mensajeDiv.remove();
        }, 5000);
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, inicializando aplicación...');
    
    // Cargar aseguradoras al iniciar
    cargarAseguradoras();
    
    // Establecer fecha actual por defecto
    const hoy = new Date().toISOString().split('T')[0];
    const fechaElabora = document.getElementById('fecha_elabora');
    if (fechaElabora && !fechaElabora.value) {
        fechaElabora.value = hoy;
    }
    
    // Event listeners
    const btnBuscarPacienteOld = document.getElementById('btn-buscar-paciente');
    if (btnBuscarPacienteOld) {
        btnBuscarPacienteOld.addEventListener('click', buscarPaciente);
    }
    
    const formulario = document.getElementById('formulario-clinico');
    if (formulario) {
        console.log('✅ Formulario encontrado, registrando event listener para submit...');
        
        // Remover cualquier listener anterior para evitar duplicados
        const nuevoFormulario = formulario.cloneNode(true);
        formulario.parentNode.replaceChild(nuevoFormulario, formulario);
        
        nuevoFormulario.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('✅ Submit del formulario detectado, iniciando guardado...');
            
            // Deshabilitar el botón para evitar doble envío
            const btnGuardar = document.getElementById('btn-guardar');
            if (btnGuardar) {
                btnGuardar.disabled = true;
                btnGuardar.textContent = 'Guardando...';
            }
            
            try {
                await guardarFormulario();
                console.log('✅ Formulario guardado exitosamente');
            } catch (error) {
                console.error('❌ Error en guardarFormulario:', error);
                mostrarMensaje('Error al guardar formulario: ' + error.message, 'error');
            } finally {
                // Rehabilitar el botón
                if (btnGuardar) {
                    btnGuardar.disabled = false;
                    btnGuardar.textContent = 'Guardar Formulario';
                }
            }
        });
        
        console.log('✅ Event listener registrado correctamente');
    } else {
        console.error('❌ ERROR: No se encontró el formulario con id "formulario-clinico"');
        alert('ERROR: No se encontró el formulario. Verifique que el HTML tenga el id correcto.');
    }
    
    // Listener directo al botón como respaldo
    const btnGuardar = document.getElementById('btn-guardar');
    if (btnGuardar) {
        console.log('✅ Botón de guardar encontrado, agregando listener directo...');
        btnGuardar.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('✅ Click en botón Guardar detectado');
            
            // Deshabilitar el botón
            btnGuardar.disabled = true;
            btnGuardar.textContent = 'Guardando...';
            
            try {
                await guardarFormulario();
                console.log('✅ Formulario guardado exitosamente desde botón');
            } catch (error) {
                console.error('❌ Error al guardar desde botón:', error);
                mostrarMensaje('Error al guardar formulario: ' + error.message, 'error');
            } finally {
                // Rehabilitar el botón
                btnGuardar.disabled = false;
                btnGuardar.textContent = 'Guardar Formulario';
            }
        });
    } else {
        console.error('❌ ERROR: No se encontró el botón con id "btn-guardar"');
    }
    
    // Event listener para buscar paciente por documento
    const btnBuscarPaciente = document.getElementById("btnBuscarPaciente");
    if (btnBuscarPaciente) {
        btnBuscarPaciente.addEventListener("click", async function () {
            const documento = document.getElementById("documento").value;

            if (!documento) {
                mostrarMensaje("Ingrese el documento del paciente", "error");
                return;
            }

            try {
                // Buscar formulario por num_identificacion del paciente usando el filtro de DRF
                // La búsqueda se hace en la tabla formulario filtrando por paciente__num_identificacion
                const formularios = await apiRequest(`/formularios/?paciente__num_identificacion=${documento}`);
                
                // DRF devuelve resultados paginados con formato {results: [...]}
                const listaFormularios = formularios?.results || formularios || [];
                
                if (listaFormularios.length > 0) {
                    // Tomar el formulario más reciente (ya está ordenado por fecha_actualizacion descendente)
                    const formulario = listaFormularios[0];
                    const paciente = formulario.paciente;
                    
                    console.log("Formulario encontrado:", formulario);
                    console.log("Paciente asociado:", paciente);
                    
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
                    
                    // Llenar campos del formulario
                    if (document.getElementById('codigo')) {
                        document.getElementById('codigo').value = formulario.codigo || '';
                    }
                    if (document.getElementById('version')) {
                        document.getElementById('version').value = formulario.version || '';
                    }
                    if (document.getElementById('fecha_elabora')) {
                        document.getElementById('fecha_elabora').value = formulario.fecha_elabora || '';
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
                    if (document.getElementById('fecha_elabora_paciente') && paciente.fecha_nacimiento) {
                        document.getElementById('fecha_elabora_paciente').value = paciente.fecha_nacimiento;
                    }
                    
                    mostrarMensaje(`Formulario encontrado (ID: ${formulario.id}). Datos cargados.`, "success");
                } else {
                    mostrarMensaje("No se encontró ningún formulario para este paciente. Puede crear uno nuevo.", "info");
                }
            } catch (error) {
                console.error("Error al buscar formulario:", error);
                mostrarMensaje("Error al buscar formulario: " + error.message, "error");
            }
        });
    }
    
    // Función para descargar PDF
    // Prioriza generar el PDF del FORMULARIO actual.
    // Si no hay formulario_id, intenta generar el PDF por PACIENTE.
    function descargarPDF(pacienteId, formularioId) {
        // 1) Intentar usar el ID de formulario (PDF estructurado con encabezado nuevo)
        if (!formularioId) {
            const formularioIdEl = document.getElementById('formulario_id');
            if (formularioIdEl && formularioIdEl.value) {
                formularioId = formularioIdEl.value;
            }
        }

        if (formularioId) {
            window.open(`/formulario/${formularioId}/pdf/`, '_blank');
            return;
        }

        // 2) Si no hay formulario_id, usar el PDF por PACIENTE (como estaba antes)
        if (!pacienteId) {
            const pacienteIdEl = document.getElementById('paciente_id');
            if (pacienteIdEl && pacienteIdEl.value) {
                pacienteId = pacienteIdEl.value;
            } else {
                alert('Debe guardar el formulario (y seleccionar un paciente) antes de generar el PDF');
                return;
            }
        }

        window.open(`/pacientes/${pacienteId}/pdf/`, '_blank');
    }

    // Hacer la función disponible globalmente para el botón del HTML
    window.descargarPDF = descargarPDF;
});

