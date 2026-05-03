
# Propósito de la app
AlphaCorte es una barbería especializada en servicios de corte de cabello y cuidado personal masculino, esta empresa a lo largo de los años ha trabajado manualmente para el manejo de citas, de horarios y demás servicios que prestan, por eso quiero crear una app que permita sistematizar y facilitar el agendamiento de citas, manejo de horarios y reseñas de las citas en la aplicación para que los procesos de AlphaCorte mejoren y sean más organizados. 

# Entidades de la app y funcionalidades

Tendremos 10 entidades en total: 
1. Credencial: Donde se guarda el usuario y la contraseña.
2. Cliente: La información del cliente que requiere un servicio en AlphaCorte.
3. Barbero: La información del barbero que trabaja en AlphaCorte. 
4. Horario: La información de la fecha y horario de un barbero o de una cita.
5. Cita: La información de la cita que se agende. 
6. Calificación: Contiene una puntuación numérica de 1 a 5 estrellas y una breve reseña para que el cliente califique su experiencia después de dicha cita. 
7. Histórico: Un historial tanto para el cliente como para el barbero donde puedan ver las citas que han tenido y las próximas citas. 
8. Procedimiento: La información del procedimiento que se va a hacer en la cita, tipos de corte, tipo de manejo y demás. 
9. citaProcedimiento: La relación de intersección de muchos a muchos entre cita y el procedimiento.
10. procedimientoHistorico: La relación de intersección de muchos a muchos de procedimiento e histórico. 

### Funcionalidades

#### Cliente
-  Tiene una credencial, un usuario y una contraseña. El cliente crea su cuenta desde la app y luego la valida en el inicio de sesión.
-  Tiene un historial donde puede ver las citas que ha tenido (citas pasadas) y las citas que tendrá (citas próximas).
- Puede agendar citas, reprogramarlas o cancelarlas (con un día de anticipación).
  Si el cliente necesita una cita en un horario que no aparece disponible en la página principal, el cliente puede solicitarla y esperar confirmación del barbero o en caso de ser rechazada solicitar otra. 
- Terminada la cita, puede calificar la cita.
  
#### Barbero
- Tiene una credencial, un usuario y una contraseña.
- Tiene un historial donde puede ver las citas que ha tenido y las citas que tendrá próximamente. 
- Puede agendar sus citas, puede reprogramar con 1 día de antelación mínimo, cancelar con 1 día de antelación mínimo.
- Puede abrir nuevos horarios de citas para que los clientes vean esa disponibilidad desde la aplicación. 
- Puede tener muchos clientes.
- Puede recibir muchas calificaciones, las cuales serán promediadas en su información personal. 
- Puede realizar muchos procedimientos según sus especialidades. 
- Cada barbero tiene un horario de trabajo específico en AlphaCorte. Un barbero solo puede tener un horario de trabajo, no muchos, pero a lo largo de ese horario puede tener diferentes citas en esas horas.
- Tiene procedimientos en los que se especializa.

#### Horario
- Tiene una fecha y hora establecida. 
- Varios barberos pueden tener en el mismo horario distintas citas. 
- Un horario de trabajo lo pueden tener varios barberos. 

#### Calificación
- El cliente es quien hace la calificación después de la hora de finalización de cada cita. 
  Al terminar la cita, automáticamente se marca la cita como Completada y le pide al cliente la calificación.
- Se puede dar una puntuación numérica de 1 a 5, siendo 5 excelente. 
- Se puede dar una reseña breve para que el cliente comente su experiencia en el servicio. 

#### Cita
- Puede ser creada, reprogramada con 1 día de antelación mínimo o cancelada con 1 día de antelación mínimo por el cliente y el barbero.
- El barbero abre los horarios disponibles, el cliente agenda estos horarios disponibles, si hay un horario que el cliente necesite y no está entre los expuestos en la página principal, puede solicitar una cita en otro horario y solicitarla al barbero, esperando confirmación de parte del barbero. 
- Solo tiene un cliente y un barbero específico.
- Puede tener uno o más procedimientos en la misma cita (ejemplo: degradado, tintura, corte clásico). 
- Tiene un solo horario donde se dará la cita, hora de comienzo y hora de finalización.  
- Cada cita, una vez realizada, pasa al historial inmediatamente del barbero y del cliente.
- Tiene una sola calificación (compuesta por puntuación y reseña) que la da el cliente.
- La cita tendrá dos estados: Pendiente o Completada. Se marcará como completada automáticamente una vez pase la hora de la cita establecida. (ejemplo: si duraba una hora, pasada esa hora la cita pasa a ser una cita completada en el historial y la app le pedirá al cliente la calificación).

#### Histórico
- Cada barbero, cada cliente, tiene su historial de citas que han tenido y citas por venir. 
- Un historial puede tener muchas citas.

#### Procedimiento
- Un mismo procedimiento puede estar en varias citas. 
- Un mismo procedimiento puede ser la especialidad de varios barberos. 
- Un cliente puede pedir varios procedimientos en una misma cita.

# Flujo de la app
La app comienza con definir el rol: Cliente o barbero.

### Rol
Comienza con una pantalla decisiva donde el usuario decide si es Barbero o Usuario, dependiendo de la selección cambia la interacción con la app. 

### Como Barbero 
#### Login
Ingresa como barbero y le pide el inicio de sesión, sus credenciales ya están en la base de datos, el barbero no crea sus credenciales sino que ya han sido creadas por el administrador de AlphaCorte, el barbero solo inicia sesión. 

#### Home
Redirección a la página principal después del login donde podrá ver: 
- Número de citas próximas, y cada cita próxima en un scroll horizontal, donde cada cita se verá como un card con acciones para reprogramar la cita o cancelarla. 
- Podrá crear y habilitar nuevos horarios para citas. 
- Un menú donde verá las distintas pantallas de la app: Home, Perfil e Historial y podrá cerrar sesión. 
- 
#### Perfil
Visualización de información personal, foto del perfil, todos los datos de su cuenta, número de citas y el promedio de calificaciones que ha recibido en las citas pasadas. 

#### Historial
Un calendario con las citas que ha tenido, el barbero puede acceder a cada día del mes y puede ver qué citas tuvo ese día con sus detalles. Si las citas son próximas, puede reprogramarlas o cancelarlas (con la condición de 1 día de antelación). También desde cada día del mes puede crear y habilitar un nuevo horario para una cita con un botón de agregado. 

### Como Usuario 
#### Login
Un registro para crear su cuenta como cliente y el inicio de sesión para verificar la cuenta creada y darle acceso a la aplicación. 

#### Home
Luego de verificar credenciales, es redirigido a la página principal donde podrá ver: 
- Citas disponibles creadas por los barberos en un scroll horizontal, donde cada cita se verá como un card con acciones para agendar la cita. 
- Podrá solicitar nuevas citas con un horario nuevo o barbero específico.
- Menú donde verá las distintas pantallas de la app: Home, Perfil e Historial y podrá cerrar sesión. 

#### Perfil
Visualización de información personal con todos los datos de su cuenta, foto del perfil y número de citas.

#### Historial
Un calendario con las citas que ha tenido, el cliente puede acceder a cada día y ver qué citas tuvo y los detalles de dichas citas, si no tiene citas puede crearlas desde allí también con un botón de agregado, también puede ver las citas próximas en el mismo calendario.