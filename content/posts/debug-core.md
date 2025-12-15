+++
title = 'Como depurar Bitcoin core'
date = 2025-12-12T21:21:58+01:00
draft = true
tags = ["bitcoin", "core", "depuración", "test"] 
+++

Cuando empiezas a colaborar en core lo una de las primeras tareas que te enfrentas es pull request review, a veces con un simple análisis estático sirve, pero otras se requiere un análisis mas profundo, en el cual depurar es fundamental, hay veces que con unos pocos logs sirve para ver como evoluciona la ejecución, pero otras es necesario depurar el código. Muchas veces los programadores evitamos depurar el código por pereza, por que no sabemos como configurar el depurador o por que nunca nos han enseñado a usarlo. Este articulo tratará de ayudar a aquellos contribuidores a core que necesitan usar el depurador pero no saben por donde empezar. 

Este articulo esta inspirado en la [guía de depuración escrita por fjarh ](https://github.com/fjahr/debugging_bitcoin), por lo que ciertas secciones serán muy similares, he considero necesario hacer la mia propia por dos razones principalemnte: la guía original esta en inglés, a pesar de que para contribuir en core es altamente recomendable hablarlo y escribirlo con fluidez, quizás haya desarrolladores de la habla hispana que lo vean como una barrera, y con este articulo trato de reducir la barrera. La otra razón es que bitcoin core [cambio el  sistema de compilación de *autotools* a cmake](https://github.com/bitcoin/bitcoin/pull/30454), dejando obsoleta la guía original.

Para esta guía utilizaremos `gdb` como depurador, dado que en mi ordenador Linux es el que tengo disponible, si tienes Windows te recomendaría familizarte con WSL2, para poder tener mi mismo flujo de trabajo, en el caso de Mac necesotaras usar `lldb` , ambos son muy similares como se indica  fjahr.

Antes de empezar de ten en cuenta dos pequeños detalles:
- Bitcoin core nos permite correr un nodo en distintas redes (mainnet, tesnet or regtest), cada una tiene su propia configuración y archivos donde guardan sus logs, a la hora de depurar debes asegurarte que estas leyendo el archivo correcto para no volverte loco.
- Los test suleen borrar los logs si no fallan, para evitarlo puedes usar el flag `--no-cleanup`
## Compilar el código
El primer paso a la hora de depurar nuestro código es compilarlo, no voy a entrar en detalle sobre como hacerlo desde 0 pues la guía se extendería mucho,  este paso se podría resumir en los siguientes pasos:
1. Clonar el repositorio de [github](https://github.com/bitcoin/bitcoin)
2. Instalar las dependecias, en la propia [documentación](https://github.com/bitcoin/bitcoin/blob/master/doc/build-unix.md#linux-distribution-specific-instructions) del repositorio tienes las intrucciones, a pesar de estar en inglés es fácil de seguir, únicamente es ir copiando los comandos en el terminal para instalar todas las herramientas necesarias.
3. Configurar el proceso de compilación, para ello basta con ejecutar este comando
	```bash
	cmake -DCMAKE_BUILD_TYPE=Debug -B build 
	```
	En el indicamos a `cmake` dos cosas, que quieres compilar en modo depuración (`-DCMAKE_BUILD_TYPE=Debug`) y que compile todo en el dorectorio `build`, este ultimo puedes poner el valor que prefieras, por el moemnto recomiendo que uses este.	
4. Compilar y construir el binario, para ello usaremos el siguiente comando
	```bash
	cmake --build build -j "$(($(nproc)/2+1))"
	```
	Este comando creará los binarios usando la configuración de la carpeta `build`. Además hemos hecho una pequeña optimización a la hora de compilar, de normal bitcon core tarda mucho en compilar, para acelarar el proceso podemos utilizar varios nucleos de nuestra CPU a la vez, para ello escribimos `-j "$(($(nproc)/2+1))"`, en este caso obtenemos el numero de núcleos de nuestra cpu con el comando  `nproc`, utilizar todos suele dar problemas así que hacemos una pequeña operación matematca para utilzar la mitad mas 1 (si tenemos 24 nucleos suaremos 13), esto puedes modificarlo al gusto, cuanto más alto sea el número mas rapido irá, pero tambien hay más posibilidades de que falle la compilación.

Tras estos pasos deberías tener ya todos tus binarios listos, para comprbarlo puedes ejecutar `ls` en la carpeta donde estan todos los ejecutables, deberías obtener algo similar a esto: 
```bash
$ ls build/bin        
bitcoin  bitcoin-cli  bitcoin-node  bitcoin-tx  bitcoin-util  bitcoin-wallet  bitcoind  test_bitcoin
```

Es muy importante tener en cuenta como ejecutar, c++ es un lenguaje compilado y no interpretado, por lo que significa que por cada cambio que hagas en el código debes recompilar todo el proyecto (repetir paso 4) aunque no lo indique explicitamente.

## Nuestro primer log
En esta guía ejecutaremos nuestro nodo en `regtest`, esto es por que nos permite tener una red local que controlamos nosotros totalmente.  Primero vamos a tratar de lanzar el nodo en dicha red, para ello utilzaremos el siguiente comando:
```bash
./build/bin/bitcoind -regtest   
``` 
Esto debería mostrar un monton de logs que por el momento nos serán irrelevantes, para tratar de comunicarnos con nuestro nodo y ver que todo va bien ejecuta:
```
./build/bin/bitcoin-cli --regtest getblockchaininfo  
```
Esto nos deberia mostrar un JSON con información de nuestra red
```JSON
{
  "chain": "regtest",
  "blocks": 0,
  "headers": 0,
  "bestblockhash": "0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206",
  "bits": "207fffff",
  "target": "7fffff0000000000000000000000000000000000000000000000000000000000",
  "difficulty": 4.656542373906925e-10,
  "time": 1296688602,
  "mediantime": 1296688602,
  "verificationprogress": 2.132682700182316e-06,
  "initialblockdownload": true,
  "chainwork": "0000000000000000000000000000000000000000000000000000000000000002",
  "size_on_disk": 293,
  "pruned": false,
  "warnings": [
    "This is a pre-release test build - use at your own risk - do not use for mining or merchant applications"
  ]
}
```
 si es la primera vez que la usamos en el campo *blocks* debería indicar un 0, sino el numero correspondiente de bloques.
En este comando lo que hemos hecho es realizar una llamada rpc a nuestro nodo. Ahora vamos a tratar de añadir nuestro primer log propio para aprender como añadirlos y poder seguir la ejecución.

Para ello abre el archivo `src/rpc/blockchain.cpp`, en el busca la función `getblockchaininfo` (en torno a la linea 1335), esta es la función que se ejecuta cuando hemos hecho la llamada rpc antes. En ella podemos poner nuestro log en la primera linea de la función de tal forma que quede algo así:
```c++
// used by rest.cpp:rest_chaininfo, so cannot be static
RPCHelpMan getblockchaininfo()
{
	//AÑADIR esta linea
    LogDebug(BCLog::RPC, "MI PRIMER LOG");

    return RPCHelpMan{"getblockchaininfo",...
```

Tras esto deberemos volver a compilar y ejecutar (notar como hemos añadido el flag `-debug=rpc` para que se imprima nuestro log):
```bash
cmake --build build -j "$(($(nproc)/2+1))"  
./build/bin/bitcoind -regtest -debug=rpc
```
Y llamar de nuevo a `getblockchaininfo`, tras esto podemos ver nuestro log en el terminal. A veces el nodo continua imprimiendo mensajes y perdemos la traza de nuestro log, para ello podemos ir a verlo en el archivo `~/.bitcoin/regtest/debug.log`. Si quieres verificar que se encuentra ahí nuestro mensaje ejecuta:
```bash
$ cat ~/.bitcoin/regtest/debug.log| grep "MI PRIMER LOG"
2025-12-12T23:22:31Z [rpc] MI PRIMER LOG
```

Recalcar que el sistema de logs de core ha mejorado bastante en las ultimas versiones, ahora nos deja tener distintas categorías para poder agrupar nuestros logs, por eso  he escrito `BCLog::RPC` como primer argumento de la función `LogDebug`, al ser para nuestro proceso de depuración puedes indicar ahí la categoría que prefieras, únicamente recuerda poner la misma categoría al iniciar `bitcoind` udando el flag `-debug`.

## Nuestro primer breakpoint

Ya hemos aprendido a poner logs en nodos bitcoin, esto suele ser suficiente bastantes veces, pero otras hace falta una depuración más seria, para ello utilizaremos `gdb`. Para que funcione correctamente es fundamental que la compilación no haya hecho optimizaciones, por lo que asegúrate de haber compilado con el flag `-DCMAKE_BUILD_TYPE=Debug`:
```
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j "$(($(nproc)/2+1))"   
``` 
Para empezar la ejecución de nuestro depurador debemos escribir:
```bash
gdb  --args ./build/bin/bitcoind -regtest  
```


De esta forma nos abrirá un terminal interactivo de depuración. En esta guía no explicaré a fondo como usar `gdb` , solo dare unas pequeñas indicaciones para que puedas empezar.
Lo primero que debemos hacer antes de comenzar la ejecución es poner un *breakpoint*, esto significa un punto donde el depurador se parará para darnos información. Para nuestro ejemplo lo pondremos en la misma función que hemos modificado antes, en este caso la función se limita a devolver `RPCHelpMan`, por lo que utilzarémos el siguiente comando para poner un breakpoint
```gdb
$ break RPCHelpMan::HandleRequest

Breakpoint 1 at 0x3aa2f5: file ./rpc/blockchain.cpp, line 1337.
```

Tras esto ya podemos iniciar la ejecución escribiendo `run` en el terminal. A continuzación debemos invocar la llamada `getblockchaininfo`de nuevo, mostrando el depurador algo asi:
```
Thread 4 "b-httpworker.0" hit Breakpoint 1, RPCHelpMan::HandleRequest (
    this=0x7fffe3ffd300, request=...) at ./rpc/util.cpp:636
```
Podemos inspeccionar la función el código fuente, vemos que toda la info esta en la variable `request` trataremos de mostrar el método invocado desde el depurador usando:
```bash
$ print request.strMethod
```
lo que nos debe devolver el siguiente texto: `	2 = "getblockchaininfo"`. De esta forma hemos conseguido satisfactoriamente, ejecutar, detener el flujo e inspeccionar variables de nuestro código.

## ¿Cuándo se obtiene el número de bloques?
Ahora te propongo un pequeño ejercicio, muestra por pantalla utilizando la función `print` de `gdb` la altura de la blockchain en la función `getblockchaininfo()` del archivo `src/rpc/blockchain.cpp`.  Trata de hacerlo por tu cuenta y luego lee la solución.

### Solución
Si has entendido el proceso de depuración habrás hecho los siguientes pasos:
1. Has abierto el archivo `src/rpc/blockchain.cpp` y buscado la función `getblockchaininfo` (en torno a la linea 1335).
2. Has visto que se inicializa una variable llamada `heigh` en la linea 1383
3. Has inicado el depurador
4. Has puesto un breakpoint en la linea siguiente a donde se asigna el valor a la variable: `break src/rpc/blockchain.cpp:1384`
5. Has ejecutado el programa con `run`
6. Desde otro terminal has llamado a la función usando el cliente rpc `./build/bin/bitcoin-cli --regtest getblockchaininfo  .
7. Has visto como el depurador llega al breakpoint e impreso el valor de la variable `print height`


{{< warning >}}
A veces el depurador no encuentra los archivos del codigo , para ello ejecuta 
```
set substitute-path /home/arejula27/workspaces/bitcoin/build/src /home/arejula27/workspaces/bitcoin/src
```
 modificando el path `/home/arejula27/workspaces/bitcoin` por la carpeta donde has clonado bitcoin core en tu ordenador.
{{</warning >}}

## Más breakpoints

Vamos a hacer un segundo ejercicio para consolidar los conceptos, trata de poner un *breakpoint* en el archivo `src/init.cpp` que solo funcione si el flag `-txindex` es usado en *bitcoind*.

{{< warning >}}
El flag se puede activar tanto por CLI al iniciar `bitcoind` como en el archivo de configuración bitcoin, para este ejercicio recomiendo quitarlo del archivo y activarlo/desactivarlo desde CLI.
{{< /warning >}}
### Solución
Si has analizado bien veras que hay una variable args que instancia `ArgsManager`, a través de esta se puede ver que flags son activados. En este caso queremos ver `txindex`, hay varias zonas donde se comprueba si esta activo, como por ejemplo en la linea 1848:
```c++
    if (args.GetBoolArg("-txindex", DEFAULT_TXINDEX)) {
        g_txindex = std::make_unique<TxIndex>(interfaces::MakeChain(node), index_cache_sizes.tx_index, false, do_reindex);
        node.indexes.emplace_back(g_txindex.get());
    }

```
Si pones un *breakpoint* en la linea 1849 (`break init.cpp:1848`) solo se activará si ejecutas 
```bash
gdb --args ./build/bin/bitcoind -regtest  -txindex
``` 


## Depurar los test unitarios
En bitcoin core hay distintos tipos de test, test unitarios, de funcionalidad y de *fuzzing*. Los primeros son test escritos en c++ que vereifican el comportamiento de ciertas funciones y todos ellos son agrupados en un binario `test_bitcoin`. Estos test han sido implemnetados usando la libreria **BOOST**, la cual tiene su propio sistema de logging. Para mostrar un ejemplo podemos ejecutar por ejemplo el test `getarg` que comprueba la clase encargada de gestionar la configuración de *bitcoind* (`GetArgs`):
```bash
build/bin/test_bitcoin --log_level=all --run_test=getarg_tests 
```
Como ves hemos especificado el nivel de log a todo (*all*), pero podemos especificar otros: `test_suite`, `message` , `warning` y `error`.

Para hacer logging de nuestros propios mensajes debemos usar mensages the boost dentro de los archivos de test y escribir los textos en la salida de error en caso de editar código fuente (no los test sino las funciones a probar):
```c++
//dentro de los test
BOOST_TEST_MESSAGE("=======MY BOOST LOG=============");
//dentro del código
fprintf(stderr, "=======MY BOOST LOG FROM THE CODE====");
```

Si queremos ver solo los mensajes que escribimos en los test usar `--log_level=message ` y si queremos solo las salidas de error `--log_level=error `.

Para comprobar esto prueba a modificar la linea 62 del archivo `src/test/getargs_test.cpp` tal que así:
```c++
BOOST_AUTO_TEST_CASE(setting_args)
{
    ArgsManager args;
    SetupArgs(args, {{"-foo", ArgsManager::ALLOW_ANY}});
	// añade esta linea
    BOOST_TEST_MESSAGE("=======MY BOOST LOG=============");

```
Compila y ejecuta el test:
```bash
cmake --build build -j "$(($(nproc)/2+1))" 
build/bin/test_bitcoin --log_level=message --run_test=getarg_tests
```

También puedes depurar usando *gdb*, pero no repeteriemos al explación ya que en este caso todo funciona igual, compilar sin optimizaciones, iniciar gdb pero esta vez con el binario de los test, poner *breakpoints* y ejecutar.

## Depurar los test funcionales
Los test funcionales en bitcoin core son test escritos en python que comprueban comportamientos en el sistema completo (frente a solo una función en los unitarios), para ello crean instancias de distintos nodos y comprueban el funcionamiento de ellos en red (RPC, consenso, mempool, wallet, P2P, etc.). Estos no se pueden depurar de la misma forma con *gdb* dado que no estan en c++.
Para correr todos ellos podemos ejecutar:
```bash
build/test/functional/test_runner.py --extended
```
Esto tardará mucho tiempo, así que si quieres correr uno o varios en concreto ejecútalo usando su nombre de archivo (puedes poner uno o varios) mediante el script `test_runner.py` :
```
build/test/functional/test_runner.py feature_rbf.py

```
Este volcará los logs en el archivo `test_framework.log` dentro de la carpeta del test (se indica en la primera linea al ejecutar el script). Por defecto esta carpeta siempre se borra al acabar si el test no falla,  se puede evitar ejecutando el tets no el flag `--nocleanup`. En mi caso el archivo se escribió en `/tmp/test_runner_₿_🏃_20251214_162745/feature_rbf_0/test_framework.log`

Si quieres mostrarlo directamente por el terminal de uno solo en concreto puedes correr el test directamente como si fuera un script:
```bash
build/test/functional/feature_rbf.py --loglevel=info
```
Para mostrar los logs a distintos niveles ejecuta los test con `--loglevel=info`, puedes añadir tus propios mensajes de la siguiente forma en el código en python:
```python
self.log.info("foo")
self.log.debug("bar")
```

También esta la posibilidad de mostrar todos los mensajes obtenidos del las llamadas rpc, ten cuidado a la hora de usarlo por que es muy verboso, para activarlo usar el flag  `--tracerpc`.

Finalmente explicaremos como depurar con un depurar estos test. Al ser python no podemos lanzar los test desde *gdb*, por lo que los pararemos en python y nos conectaremos al proceso. Lo primero es añadir este texto sobre el test a depurar:
```python
import pdb; pdb.set_trace()
```

En nuestro caso podemos editar `test/functional/feature_rbf.py` en la linea 28, quedando algo asi:
```python
import pdb; pdb.set_trace()
class ReplaceByFeeTest(BitcoinTestFramework):
```

A continuación compilamos sin optimizaciones:
```
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j "$(($(nproc)/2+1))"   
```

Ahora lanzaremos el test (sin usar el lanzador): 
```
$ ./build/test/functional/feature_rbf.py
> /home/arejula27/workspaces/bitcoin/build/test/functional/feature_rbf.py(28)<module>()
-> pdb.set_trace()
(Pdb)
```

Si vemos el output así siginifca que esta a la espera nuestro test. Ahora ponemos un breakpoint en el codigo fuente en c++ que se será llamado, en este caso el test llama a la función rpc `sendrawtransaction`, podemos tratar de obtener el tamaño virtual de las transacciones. Para ello poner un breakpoint en  `b src/rpc/mempool.cpp:96` y darle a continuar tanto en *gdb* como  en *pdb*. Entonces veremos algo como esto
```
(gdb) c
Continuing.
[Switching to Thread 0x7f40077fe6c0 (LWP 13012)]

Thread 7 "b-httpworker.0" hit Breakpoint 1, operator() (__closure=0x7f40077fc320, self=..., request=...) at ./rpc/mempool.cpp:96
96                  CAmount max_raw_tx_fee = max_raw_tx_fee_rate.GetFee(virtual_size);

```
Como vemos ya estamos parados en nuestro breakpoint, ahora podemos obtener los valores de la misma forma que lo hacíamos antes.
```
(gdb) p virtual_size
$1 = 147
```

## Conclusión

Bitcoin core es un proyecto complejo y encontrar el punto exacto donde se produce un fallo puede ser tedioso, a veces con los propios logs del programa sirven, pero otras una búsqueda más exhaustiva es necesario. En esta guía hemos aprendido como podemos poner nuestros propios logs tanto en el nodo como en los test. Hay veces que solo con logs no es suficiente sino que necesitas investigar linea por linea, para eso utilizaremos el depurador.


## Sources
- [fjahr/bitcoin_debugging.md](https://gist.github.com/fjahr/2cd23ad743a2ddfd4eed957274beca0f)
- [Debugging Bitcoin Core Workshop](https://gist.github.com/fjahr/5bf65daaf9ff189a0993196195005386)
- https://github.com/bitcoin/bitcoin/blob/master/doc/build-unix.md
- https://github.com/bitcoin/bitcoin/blob/master/doc/developer-notes.md
- https://github.com/bitcoin/bitcoin/blob/master/test/README.md
