+++
title = 'Autenticación en servidores Golang con el paquete Goth'
date = 2024-12-02T02:45:08+01:00
draft = false
description= "Aprende a autenticar usuarios en aplicaciones web usando el paquete Goth y el framework Echo en Golang. Este paquete proporciona una API simple para autenticar en muchos proveedores, incluyendo Google, GitHub y Facebook."
ShowToc= true
etiquetas= ["golang", "web", "autenticación", "goth", "echo"]
+++

Una de las tareas más comunes en el desarrollo web es la autenticación de usuarios. Necesitas una manera de verificar que el usuario es quien dice ser para permitirle acceder a sus datos.

Hoy en día, hay muchas maneras de autenticar usuarios. Algunos desarrolladores implementan su propio sistema de autenticación, sin embargo, exploré cómo usar un servicio de terceros para autenticar usuarios con sus cuentas de Google, Facebook o GitHub.

En el ecosistema de JavaScript usé [Passport.js](https://www.passportjs.org/) en algunos proyectos, esta biblioteca proporciona una interfaz común para autenticar usuarios en muchos proveedores. En el ecosistema de Go, encontré el paquete [Goth](https://github.com/markbates/goth).

En este artículo explicaré con ejemplos de código cómo implementar un sistema de autenticación y autorización para un servidor [Echo](https://echo.labstack.com/). En caso de que prefieras usar la biblioteca estándar, consulta este [ejemplo](https://github.com/markbates/goth/blob/master/examples/main.go) y para `chi` mira este [video](https://www.youtube.com/watch?v=iHFQyd__2A0&t=505s).

En este artículo se da por supuesto que tienes conocimientos básicos de Go y Echo y que ya tienes un modulo inicializado.

## Instalación
El primer paso es instalar el paquete usando el comando `go get`.
```bash
go get github.com/markbates/goth
```

## Uso
El paquete `goth` funciona usando el paquete [gorilla/sessions](https://github.com/gorilla/sessions), por lo que es necesario configurar el `Store` antes de usarlo. Esto configura la forma en que se alamacenan las sesiones en la aplicación, en este caso únicamente guardaremos las cookies en memoria.

```go
store := sessions.NewCookieStore([]byte(key))
store.MaxAge(MaxAge)
store.Options.Path = "/"
store.Options.HttpOnly = true
store.Options.Secure = IsProd

gothic.Store = store
```

Después, se deben configurar todos los proveedores deseados. Consulta los [proveedores compatibles](https://github.com/markbates/goth#supported-providers) para más información. Cada proveedor tiene su propia configuración, pero todos exponen la misma interfaz. En el siguiente ejemplo, configuramos el proveedor de Google, el cual requiere un `ClientID`, `ClientSecret` y un `CallbackURL`. Los dos primeros son proporcionados por Google en la [Google Developer Console](https://console.developers.google.com/), y el último es la URL donde el usuario será redirigido después del proceso de autenticación (lo configuraremos más adelante).

```go
googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
googleClientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
goth.UseProviders(google.New(googleClientID, googleClientSecret, "http://localhost:3000/auth/google/callback"))
```

Este paquete requiere configurar algunas rutas: `login`, `callback` y `logout`. 
```go
e.GET("/auth/:provider/callback", googleCallback)
e.GET("/logout/:provider", logout)
e.GET("/login/:provider", auth)
```

El parámetro `:provider` es necesario porque `goth` soporta múltiples proveedores, por lo que necesita saber cuál usar y lo detecta a través de la URL, es decir, si la URL es `/auth/google/callback`, usará el proveedor de Google.

El `googleCallback` será llamado después de que Google autentique al usuario y recibirá los datos del usuario.
```go
func googleCallback(c echo.Context) error {
	user, err := gothic.CompleteUserAuth(c.Response(), c.Request())
	if err != nil {
		log.Println(err)
		return c.String(http.StatusInternalServerError, "Error")
	}
	//guardar el usuario en la sesión
	userJSON, err := json.Marshal(user)
	if err != nil {
		return err
	}
	err = gothic.StoreInSession("user", string(userJSON), c.Request(), c.Response())
	if err != nil {
		return err
	}
	return c.Redirect(http.StatusTemporaryRedirect, "/user")
}
```

Como `goth` no guarda ningún dato en la sesión, también añadimos algunos datos para que puedan ser usados más tarde en nuestra aplicación. Esto se hace mediante la función `gothic.StoreInSession`. En este caso, se guarda el usuario completo, pero sería mejor guardar solo el correo electrónico.

Al final, la función redirigirá a una ruta restringida.

La función `auth` es responsable de iniciar sesión en la aplicación. Debe ser llamada desde un botón en el código HTML.
```go
func auth(c echo.Context) error {

	_, err := gothic.GetFromSession("user", c.Request())
	//si el usuario ya está logueado, redirigir a la página de usuario
	if err == nil {
		return c.Redirect(http.StatusTemporaryRedirect, "/user")
	}

	provider := c.Param("provider")
	res := c.Response()
	req := c.Request().WithContext(context.WithValue(context.Background(), "provider", provider))
	gothic.BeginAuthHandler(res, req)
	return nil
}
```

Dado que el usuario se guarda en la sesión, primero verificamos si ya está logueado. En ese caso, será redirigido. De lo contrario, usaremos la función `gothic.BeginAuthHandler` para solicitar las credenciales al usuario a través del proveedor especificado.

Como estamos usando el framework Echo, es necesario guardar el proveedor en el contexto. Sin embargo, si usamos la biblioteca estándar, esto no sería necesario.

Finalmente, debemos añadir un endpoint para cerrar sesión.
```go
func logout(c echo.Context) error {
	provider := c.Param("provider")
	res := c.Response()
	req := c.Request().WithContext(context.WithValue(context.Background(), "provider", provider))
	gothic.Logout(res, req)
	return c.Redirect(http.StatusTemporaryRedirect, "/")
}
```

## Middleware de autorización
Este paquete nos ayuda a iniciar sesión usando un tercero y crear la sesión para el usuario. Sin embargo, no proporciona un middleware para verificar si el usuario ha iniciado sesión o no. Para ello, debemos implementar un pequeño middleware que se ejecute antes de nuestro handler HTTP.
```go
func AuthorizationMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {

		//verificar si la sesión es válida
		userJSON, err := gothic.GetFromSession("user", c.Request())
		if err != nil {
			return c.JSON(401, map[string]string{"message": "No autorizado"})
		}
		var user goth.User
		err = json.Unmarshal([]byte(userJSON), &user)

		if err != nil {
			return c.JSON(401, map[string]string{"message": "No autorizado"})
		}
		c.Set("user", user)
		return next(c)
	}
}
```

Esta función recibe un `echo.HandlerFunc` y devuelve el mismo para que pueda ser usado como middleware en `Echo`. Recuperará al usuario de la sesión. Si todo funciona correctamente, el usuario está logueado y el middleware continuará al handler. En caso de que algo salga mal, la aplicación devolverá un error `401 Unauthorized`.

Al final de la función, los datos recuperados de la sesión se almacenarán en el contexto de la solicitud para que puedan ser usados en el handler.

## Conclusión
Este paquete es una excelente manera de autenticar usuarios en aplicaciones web. Proporciona una API simple para autenticación en muchos proveedores, incluyendo Google, GitHub y Facebook. Es fácil de usar y configurar, y funciona bien con el framework Echo. Puedes encontrar el código completo en este [repositorio](https://github.com/arejula27/go-lab/tree/main/auth).
