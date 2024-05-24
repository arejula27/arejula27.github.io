---
external: false
draft: false 
title: Authenticating with Goth package 
description: Article on how to authenticate users in web applications using the Goth package and Echo framework in Golang.
date: 2024-05-24
---
This is a Go package that provides a simple way to authenticate users in web applications. It provides a simple API for authentication in many providers, including Google, GitHub, and Facebook.

This manual uses the Echo framework. In case of using just the standard library see this [example](https://github.com/markbates/goth/blob/master/examples/main.go) and for `chi` watch this [video](https://www.youtube.com/watch?v=iHFQyd__2A0&t=505s).
## Installation

```bash
go get github.com/markbates/goth
```
## Usage

It works using the [gorilla/sessions](https://github.com/gorilla/sessions) package, so it is required to config the `Store` before using it.

```go
store := sessions.NewCookieStore([]byte(key))
store.MaxAge(MaxAge)
store.Options.Path = "/"
store.Options.HttpOnly = true
store.Options.Secure = IsProd

gothic.Store = store
```
Then all wanted providers must be configured, see the [supported providers](https://github.com/markbates/goth#supported-providers) for more information.
Each provider has its own configuration, but all of them expose the same interface. In the following example, we configure the Google provider, it requires a `ClientID`, `ClientSecret`, and a `CallbackURL`. The first two are provided by Google in the [Google Developer Console](https://console.developers.google.com/), and the last one is the URL where the user will be redirected after the authentication process (we will set it up later).

```go
googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
googleClientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
goth.UseProviders(google.New(googleClientID, googleClientSecret, "http://localhost:3000/auth/google/callback"))
```

This packages requires a few routes to be set up, `login`, `callback` and `logout`. 
```go
e.GET("/auth/:provider/callback", googleCallback)
e.GET("/logout/:provider", logout)
e.GET("/login/:provider", auth)
```

The `:provider` parameter is required because `goth` supports multiple providers, so it needs to know which one to use and it detect it by the URL.

The `googleCallback` will be called after google authenticates the user and will receive the user data
```go
func googleCallback(c echo.Context) error {
	user, err := gothic.CompleteUserAuth(c.Response(), c.Request())
	if err != nil {
		log.Println(err)
		return c.String(http.StatusInternalServerError, "Error")
	}
	//save the user to the session
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
As `goth` do not save any data in the session we also add some data to it so we can used later in our app. It is done by the `gothic.StoreInSession` function. In this case the whole user is stored but it will be better to save only the gmail.

At the end the function will redirect to a restricted route.

The `auth` function is responsible for login the user in the application. It must be called from a button in the HTML code.
```go
func auth(c echo.Context) error {

	_, err := gothic.GetFromSession("user", c.Request())
	//if the user is already logged in, redirect to the user page
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
As the user is saved in the session first we check if the user is already logged, in that case it will be redirect. In the other hand we will use the `gothic.BeginAuthHandler` function for request the credentials to teh user via the provider specified.

As we are using echo framework it is required to save the provider in the context, however if we are using the standard library this is not needed.

Finally we have to add a endpoint to logout.
```go
func logout(c echo.Context) error {
	provider := c.Param("provider")
	res := c.Response()
	req := c.Request().WithContext(context.WithValue(context.Background(), "provider", provider))
	gothic.Logout(res, req)
	return c.Redirect(http.StatusTemporaryRedirect, "/")
}
```

## Authorization middleware
This package help us to login using a third party and create the session for the user. However, it does not provide a middleware for checking if the user is logged in or not. For that we must implement a small middleware that will be executed before our HTTP handler.
```go
func AuthorizationMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {

		//check the session is valid
		userJSON, err := gothic.GetFromSession("user", c.Request())
		if err != nil {
			return c.JSON(401, map[string]string{"message": "Unauthorized"})
		}
		var user goth.User
		err = json.Unmarshal([]byte(userJSON), &user)

		if err != nil {
			return c.JSON(401, map[string]string{"message": "Unauthorized"})
		}
		c.Set("user", user)
		return next(c)
	}

}
```
This function receives a `echo.HandlerFunc` and returns the same so it can be used as middleware in [[Echo]]. It will retrieve the user from the session. If everything works fine the user is logged and the middleware would continue to the handler. In case soemthing wrong happens the application would return an error `401 Unauthorized` .

At the end of the function the data retrieve from the session will b stored in the request context so it can be used in the handler.

## Conclusion
This package is a great way to authenticate users in web applications. It provides a simple API for authentication in many providers, including Google, GitHub, and Facebook. It is easy to use and configure, and it works well with the Echo framework.  You can find the complete code in this [repository](https://github.com/arejula27/go-lab/tree/main/auth).

