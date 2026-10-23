# 🐾 Dashboard de Embarques y Control de Tarimas - Petco México

Aplicación web interactiva lista para **GitHub Pages** diseñada para visualizar en tiempo real el estado operativo del área de **Embarques de Petco**, conectada directamente a la hoja de Google Sheets:
`1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E`.

---

## 📊 ¿Qué analiza y determina este Dashboard?

A partir de las columnas clave de tu hoja de cálculo, el sistema calcula tanto los indicadores directos como **inteligencia operativa adicional**:

1. **Tarimas Libres (`Tarimas Libres`):**
   - Cuantifica el volumen total de tarimas en el área de embarques y distingue cuántas **siguen libres en piso (sin unidad)** frente a las que ya tienen unidad asignada.
   - Soporta tanto columnas con cantidades numéricas de tarimas como folios/IDs individuales por fila.
2. **Tiendas Destino (`Ce. Nombre`):**
   - Agrupa el volumen de tarimas por número y nombre de tienda Petco.
   - Genera un **Semáforo de Cobertura por Tienda** con porcentaje de avance de asignación de transporte y detección de las tiendas con mayor acumulación en andén.
3. **Perfil de Carga (`Tipo Pallet`):**
   - Desglosa las tarimas listas para envío según su tipo de pallet (`CHEP`, `Estándar`, `Seco Mixto`, `Bulto Alimento`, `Voluminoso`, etc.) para planificar el equipo de carga adecuado.
4. **Asignación y Consolidación de Unidades (`Transporte`):**
   - Identifica todos los números de transporte activos, qué tiendas están consolidadas en cada viaje y el **% de saturación de caja** (estimado sobre una capacidad estándar de 24 tarimas por tráiler).
   - Calcula automáticamente **cuántos tráilers adicionales se requieren** para desalojar las tarimas libres que aún no tienen transporte.
5. **Antigüedad FIFO y Alertas de Rezago (`Fch. Crea.`):**
   - Calcula los **días de antigüedad en piso** de cada tarima comparando `Fch. Crea.` contra la fecha actual/corte.
   - Emite alertas automáticas de **Rezago (+2 días sin transporte)** y muestra una curva de envejecimiento (0 días, 1 día, 2 días, 3+ días) para priorizar la salida bajo criterio FIFO.

---

## 🔌 Cómo conectar los datos en vivo desde Google Sheets

Tienes **3 métodos integrados** sin cambiar código:

### Opción 1: Conexión Directa (En 10 segundos)
1. Abre la hoja de cálculo en Google Drive:  
   `https://docs.google.com/spreadsheets/d/1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E/edit`
2. Haz clic en el botón **Compartir** (esquina superior derecha).
3. En **Acceso general**, selecciona **"Cualquier persona con el enlace"** en modo **Lector**.
4. Recarga el Dashboard y automáticamente se pondrá en verde (**Google Sheets En Vivo**).

### Opción 2: Manteniendo la Hoja Privada (Vía Google Apps Script)
Si por políticas la hoja no puede compartirse con enlace de lectura:
1. Dentro de la hoja de Google Sheets, entra a **Extensiones > Apps Script**.
2. Pega el contenido del archivo [`google-apps-script/Code.gs`](./google-apps-script/Code.gs).
3. Haz clic en **Implementar > Nueva implementación > Aplicación web**.
4. Elige *Ejecutar como: Yo* y *Quién tiene acceso: Cualquiera*.
5. Copia la URL `/exec` generada, abre el botón **⚙️ Conexión** en el Dashboard y pégala.

### Opción 3: Carga Manual de Excel / CSV
- En la barra superior del Dashboard puedes hacer clic en **Cargar Excel/CSV** para subir un corte descargado (`.xlsx` o `.csv`) y analizarlo al instante en el navegador.

---

## 🚀 Cómo publicar en GitHub Pages

Si subes este repositorio a GitHub:
- La app principal de Acomodo estará en: `https://TU_USUARIO.github.io/TU_REPO/`
- El **Dashboard de Embarques Petco** estará disponible en:  
  `https://TU_USUARIO.github.io/TU_REPO/dashboard-embarques/`

También puedes subir únicamente el contenido de la carpeta `dashboard-embarques` a un repositorio nuevo si deseas que tenga su propio dominio independiente.
