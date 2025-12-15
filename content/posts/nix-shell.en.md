+++
title = 'Create development environment with Nix'
date = 2025-01-01T12:46:40+01:00
draft = false
tags = ['nix','containers', 'docker','devenvironment']
+++

One of the challenges for many projects is having an easy way to configure and set up the environment. This becomes even more important when an open-source project is looking for contributors. There are plenty of tools in the market that can help with these tasks. In this post, I’ll dive deeper into development environments, which are a subcategory of tools that install and configure all the external dependencies a project needs to run, requiring no manual intervention from the developer and giving him all the required tools for start working.

==TODO: ADD the idea of as an FOSS enthusiats portability is key, and the importance of having a reproducible environment==


Development environments are a game-changer for any project. They not only make it easier for new contributors to start working on the project, but also help with many other common issues in software development. Using a development environment ensures that every developer shares the same setup, which can help avoid common issues such as *it works on my machine* or *it works on my machine but not on yours*. It also helps keeping the project dependencies up to date. It can even be used in your DevOps pipeline to ensure that the project is always built in the same environment. What a dream, right? Now any project is totally reproducible.


## Devcontainers

Over the last few years, using containers to create development environments has become a common practice, even being [standardized](https://containers.dev/implementors/spec/) for many editors and IDEs. The idea behind them is to define a container using Docker, start it when opening the project, and do all the development inside the container while keeping the coding experience the same as programming on the host machine. This environment is defined within the project, making it easy to share with other developers and include it in version control systems like Git/GitHub. 

The main advantages of using containers are that most developers are already familiar with Docker, they know how to define a container, and the container can share the project folder as a volume, making it accessible from both the host and the development environment. However, after using this approach for a while, I found some drawbacks that made me look for alternatives. 

First, when the project was simple, this was more than enough. However, when the project grew bigger and required different components (databases, message brokers, etc.), the environment became more of a difficulty than a help. I started messing up network configurations, ports, etc.

Also, the build time was really slow. A container is nothing more than a lightweight operating system, so it must include many unnecessary packages and configurations. For example, if you want to run MongoDB in your development environment, it will probably fail because of the locales configuration. Additionally, each time you modify the Dockerfile, you must rebuild the container, which can take a while.

## Nix
Nix is a different approach about how to define environments. Nix ecosystem is so wide, it has a package manager, a programming language, a build system, and even a Linux distribution. In this post, I’ll focus on the package manager and how it can be used to define development environments, but I recommend you to check the other tools as well.

Nix is a package manager that not only has the bigger repository, being even larger than the AUR (Arch linux) and compatible with Linux, MacOs and Windows (using WSL2) but also has a unique feature: it is purely functional. This means that our system is defined by a set of packages and configurations, and we can reproduce it at any time. It allows users  to describe their desire system in a file, and Nix will take care of installing all the dependencies and configurations for your computer.

Nix also allow us to define isolated environments, called `nix-shell`, this can be used for trying a new tool without fully installing in your system, however we can took advantage of this feature to define our development environment. We can define a `shell.nix` file in our project, and when we run `nix-shell` in the project folder, Nix will create a new environment with all the dependencies we need to run the project. The terminal will be inside a shell with all the dependecies and binaries required for developing the project, however it will not be a container neither a totally isolated environment, you will be in your machine with all the tools you need.
 

## Define our Nix-shell

Nix shells are definied in a file called `shell.nix`, this file is a Nix expression that describes the environment we want to create. In this file we can define the packages we want to install, the environment variables, the scripts to run, etc.

The simplest `shell.nix` file is the following:

```nix
{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  packages = [
  ];
}
```
The previous expression looks simple but it is doing a lot of things. The nix shell is defined by a function that receives a set of packages and returns a shell. The parameter of the function is a set of packages that we are going to use in our shell. With the expression between curly braces we are saying use the set of packages injected by the user or if it is not provided, import the nixpkgs repository. With this approach we allow flexibility in case the project grows and we need to add custom packages that are not in the nixpkgs repository while keeping the default behavior of using the nixpkgs repository.

The `mkShell` function is a function that creates a shell with the packages we define in the `buildInputs` attribute. In this case, we are not defining any package, so the shell will be empty. Highligthing  that the `mkShell` function is also a nix package, so we are importing it from the nixpkgs repository with the `pkgs.` prefix.

Now, let's add some packages to our shell, this is as simple as adding the package name to the `buildInputs` attribute.
For example, let's add `zulu8` (a Java distribution):
```nix
{ pkgs ? import <nixpkgs> {} }:

{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  packages= [
	pkgs.zulu8
  ];
}
```

Despite the size of the nixpkgs repository, it is possible that the package you are looking for is not there. In this case, we can define our own package. This can be a bit more complex, for some packages but for simple packages it is quite easy. Lets say that we installed Java because we wanted to use Spark, so we will installed it directly from the Apache website. We can define a package that downloads the tarball from the website and installs it in the nix store.
```nix
{ pkgs ? import <nixpkgs> {} }:
let
  # Version, URL and hash of the Spark binary
  sparkVersion = "3.5.0";
  sparkUrl = "https://archive.apache.org/dist/spark/spark-${sparkVersion}/spark-${sparkVersion}-bin-hadoop3.tgz";
  # The hash must match the official one at https://archive.apache.org/dist/spark/spark-3.5.0/spark-3.5.0-bin-hadoop3.tgz.sha512
  sparkHash = "8883c67e0a138069e597f3e7d4edbbd5c3a565d50b28644aad02856a1ec1da7cb92b8f80454ca427118f69459ea326eaa073cf7b1a860c3b796f4b07c2101319";

  # Derivation for preparing the Spark binary
  # Warning: It does not include the JAVA runtime, it must be installed separately
  spark = pkgs.stdenv.mkDerivation {
    pname = "spark";
    version = sparkVersion;

    # Fetch the tarball
    src = pkgs.fetchurl {
      url = sparkUrl;
      sha512 = sparkHash;
    };
    # Install the tarball on the system, it will be located /nix/store/...
    installPhase = ''
      mkdir -p $out
      tar -xzf $src --strip-components=1 -C $out
    '';
    # Define the metadata of the derivation, not relevant for the build
    meta = {
      description = "Apache Spark ${sparkVersion} with prebuilt Hadoop3 binaries";
      licenses= pkgs.licenses.apache2;
      homepage = "https://spark.apache.org";
    };
  };
in
pkgs.mkShell {
  packages = [
	pkgs.zulu8
	spark
  ];
 # Configure the environment variables
  SPARK_HOME = "${spark.out}";
  

  # Script to be executed when the shell is started
  shellHook = ''
	echo "Spark ${sparkVersion} installed in $SPARK_HOME"
    echo "Try 'spark-shell'."
  '';
}
```

I added too many lines to the file, so lets explain them. First of all we divided our nix expression in two parts, the first part is the `let` block, where we define variables and the `in` block where we define the shell.

The idea behind this structure is to define a variable `spark` with our new packae and them addin it to the `packages` attribute of the shell. We also added the spark version and the hash of the tarball as variables for making the file easier to maintain however we could have added them directly in the derivation.

Now, lets explain how we defined our scala package. It is defined by a expression that in the Nix language is called a derivation. A derivation is a set of attributes that define a package. In this case we defined the `pname` and `version` attributes that are the name and version of the package.




The `mkDerivation` function is a function that creates a package, it receives a set of attributes that define the package. The most important attributes are `installPhase` that defines the steps to install the package and `meta` that defines the metadata of the package.

We also defined a variable `src` where we download the tarball from the Apache website. We used the `fetchurl` function that downloads the file and checks the hash. Notice that this function is not a builtin function from nix, but is located insie a packages in nixpaks so we can access it with the `pkgs.` prefix.

After dowloading the tarball we defined the `installPhase` attribute that is a script that is executed when the package is installed. We saved the location of the tarball in the variable `src` so we can easily reference it. In the script we also used `$out` that is a variable that points to the location where the package will be installed, we do not need to define that location as it is managed by nix. We used the `tar` command to extract the tarball in the `$out` folder.

We defined the `meta` attribute that is a set of metadata of the package. In this case we defined the description, the license and the homepage of the package

After defining the package we added it to the `packages` attribute of the shell. We also defined the `SPARK_HOME` environment variable that points to the location of the spark package.


Finally, we defined the `shellHook` attribute that is a script that is executed each time the user starts the shell. In this case we used it to print a message with the version of the spark package and the location of the `SPARK_HOME` variable.

## Conclusion

In this article we learned the advantages of using development environments, how to define a development environment with Nix and how to define a custom package in Nix. We also learned how to define a `shell.nix` file that is used to define a development environment in Nix.

Despite Nix is not a new technology (was realized in 2003), it is not as popular as other package managers like apt or brew or even as Docker for defining environments.  This means that the support for Nix is not as wide as other technologies, while VSCode and Intellij has a plugin to work with Docker devcontainers, there is no plugin for Nix. However, the Nix community is growing and there are many projects that are using Nix for defining their environments.  I find Nix a great tool for defining development environments, it is easy to use, it is reproducible and it removes all the issues I had with Docker containers. I recommend you to give it a try.
