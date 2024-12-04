+++
title = 'Create development environment with Nix'
date = 2024-12-04T12:46:40+01:00
draft = true
tags = ['nix','containers', 'docker','devenvironment']
+++

One of the challenges for many projects is having an easy way to configure and set up the environment. This becomes even more important when an open-source project is looking for contributors. There are plenty of tools in the market that can help with these tasks. In this post, I’ll dive deeper into development environments, which are a subcategory of tools that install and configure all the external dependencies a project needs to run, requiring no manual intervention from the developer and giving him all the required tools for start working.

==ADD the idea of as an FOSS enthusiats portability is key, and the importance of having a reproducible environment==


Development environments are a game-changer for any project. They not only make it easier for new contributors to start working on the project, but also help with many other common issues in software development. Using a development environment ensures that every developer shares the same setup, which can help avoid common issues such as *it works on my machine* or *it works on my machine but not on yours*. It also helps keeping the project dependencies up to date. It can even be used in your DevOps pipeline to ensure that the project is always built in the same environment. What a dream, right? Now any project is totally reproducible.


## Devcontainers

Over the last few years, using containers to create development environments has become a common practice, even being [standardized](https://containers.dev/implementors/spec/) for many editors and IDEs. The idea behind them is to define a container using Docker, start it when opening the project, and do all the development inside the container while keeping the coding experience the same as programming on the host machine. This environment is defined within the project, making it easy to share with other developers and include it in version control systems like Git/GitHub. 

The main advantages of using containers are that most developers are already familiar with Docker, they know how to define a container, and the container can share the project folder as a volume, making it accessible from both the host and the development environment. However, after using this approach for a while, I found some drawbacks that made me look for alternatives. 

First, when the project was simple, this was more than enough. However, when the project grew bigger and required different components (databases, message brokers, etc.), the environment became more of a difficulty than a help. I started messing up network configurations, ports, etc.

Also, the build time was really slow. A container is nothing more than a lightweight operating system, so it must include many unnecessary packages and configurations. For example, if you want to run MongoDB in your development environment, it will probably fail because of the locales configuration. Additionally, each time you modify the Dockerfile, you must rebuild the container, which can take a while.

## Nix


## Define our Nix-shell

## Conclusion


