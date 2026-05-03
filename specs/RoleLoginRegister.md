Son tres pantallas: 
Role, Login y Register.

# Role
Aquí comienza la app, definiendo el rol del usuario, debe tener
1. Título: ¡Bienvenido!
2. Dos botones: 'Barbero' y  'Usuario'. 

Según el rol que se elija, continúa el flujo de la app.

_**Barbero**_
Login (Sus credenciales ya están creadas en la base de datos) -> Home (diferente al del cliente) con menú de navegación donde puede dirigirse a: Perfil o Historial. 

_**Usuario**_
Registro -> Login -> Home (diferente al del barbero) con menú de navegación donde puede dirigirse a: Perfil o Historial. 

# Login de Barbero
Si es barbero, pasa al login donde se conecta con la base de datos para validar las credenciales.
El registro consiste en:
1. Título: Iniciar Sesión
2. Campos de entrada de texto: 
	1. Credencial
	2. Contraseña
	3. Botón 'Iniciar sesión'

Redirige al home.

# Register de Usuario
Si es usuario, pasa al register donde se conecta con la base de datos para agregar las nuevas credenciales.
El registro consiste en:
1. Título: Registrarse
2. Campos de entrada: 
	1. Nombre
	2. Usuario
	3. Teléfono
	4. Contraseña
	5. Botón 'Registrarse'
	6. Texto pequeño: ¿Ya tienes cuenta? Iniciar Sesión ('Iniciar Sesión' con href para pasar al login si ya tiene cuenta)

Pasa al login. 

# Login de Usuario
Se conecta con la base de datos para validar las nuevas credenciales.

1. Título: Iniciar Sesión
2. Campos de entrada: 
	1. Usuario
	2. Contraseña
3. Botón 'Iniciar Sesión'
4. Texto pequeño: ¿No tienes cuenta? Registrarse ('Registrarse' con href para pasar al registro si no tiene cuenta)

Redirige al home.