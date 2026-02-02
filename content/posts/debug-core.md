+++
title = 'Cómo depurar Bitcoin Core'
date = 2026-01-17T00:44:31+01:00
draft = false
tags = ['bitcoin', 'crypto', 'blockchain', 'btc', 'addresses']
+++
# How to debug Core

Cuando alguien comienza a colaborar en Bitcoin Core, una de las primeras tareas a las que se enfrenta es la revisión de *pull request*. En muchos casos, un análisis estático del código es suficiente. Pero en otras ocasiones, es necesario realizar un análisis más profundo, donde la depuración se vuelve una herramienta fundamental. 

Durante la depuración, es habitual añadir logs para observar cómo evoluciona la ejecución del programa. No obstante, hay situaciones en las que este enfoque es insuficiente, y es necesaria una depuración más precisa mediante el uso de *breakpoints* y de un depurador interactivo. 

Este artículo está inspirado en la [Guía de Depuración escrita por fjarh ](https://github.com/fjahr/debugging_bitcoin), por lo que algunas secciones pueden resultar similares. Aún así, he considerado necesario elaborar esta guía por dos motivos principales: 
1. La guía original está en inglés. Aunque para contribuir a Bitcoin Core es altamente recomendable tener un buen dominio de este idioma, esto puede suponer una barrera inicial para desarrolladores de habla hispana. Este artículo pretende ayudar a reducir dicha barrera.  
2. Bitcoin Core [ha migrado su sistema de compilación de *autotools* a CMake](https://github.com/bitcoin/bitcoin/pull/30454), lo que deja obsoleta parte de la información contenida en la guía original. 

Para esta guía se utilizará `gdb` como depurador, ya que es el que tengo disponible en mi entorno Linux. Si utilizas Windows, te recomendaría familiarizarte con `WSL2` para poder seguir un flujo de trabajo similar. En macOS, deberás usar `lldb`, que es conceptualmente muy parecido a `gdb`, tal y como indica fjahr en su documentación. 

Antes de comenzar, conviene tener en cuenta dos detalles importantes: 

- Bitcoin Core permite ejecutar nodos en distintas redes (mainnet, testnet o regtest). Cada una tiene su propia configuración y archivos de registro (logs). A la hora de depurar, es fundamental asegurarse de que se están consultado los archivos correctos para evitar confusiones. 
- Los test suelen eliminar los archivos de log cuando finalizan correctamente. Si deseas conservarlos para su análisis, puedes utilizar el flag `--no-cleanup`.

## Compilar el código
El primer paso para depurar el código es compilarlo correctamente. Para ello, debemos seguir los siguientes pasos: 
1. Clonar el repositorio oficial desde [GitHub](https://github.com/bitcoin/bitcoin).
2. Instalar las dependencias necesarias. En la [documentación oficial](https://github.com/bitcoin/bitcoin/blob/master/doc/build-unix.md#linux-distribution-specific-instructions) encontraremos instrucciones detalladas para cada distribución Linux. Aunque la documentación está en inglés, es fácil de seguir: básicamente consiste en ejecutar una serie de comandos para instalar las herramientas requeridas. 
3. Configurar el proceso de compilación ejecutando el siguiente comando: 
	```bash
	cmake -DCMAKE_BUILD_TYPE=Debug -B build 
	```
	Con este comando indicamos a `cmake` dos cosas: 
    - Que queremos compilar en modo depuración (`-DCMAKE_BUILD_TYPE=Debug`), lo que incluirá símbolos de depuración en los binarios. 
    - Que todo el proceso de compilación se realice en el directorio `build`. Podemos elegir otro nombre si lo deseamos, pero se recomienda usar éste para mantener la convención. 
4. Compilar y generar los binarios con el siguiente comando: 
	```bash
	cmake --build build -j "$(($(nproc)/2+1))"
	```
	Este comando construye los binarios utilizando la configuración definida en el directorio `build`. Además, se aprovecha de la compilación en paralelo para acelerar el proceso. 

    Bitcoin Core puede tardar bastante en compilar, por lo que es recomendable usar varios núcleos de la CPU. El comando `nproc` devuelve el número total de núcleos disponibles, y la expresión `-j "$(($(nproc)/2+1))"` utiliza aproximadamente la mitad más uno: por ejemplo, en una CPU de 24 núcleos, se usarían 13. 

    Podemos ajustar este valor según nuestro sistema: cuantos más núcleos utilicemos, más rápida será la compilación, aunque también aumentará la probabilidad de errores o de un uso excesivo de recursos.

Tras completar estos pasos, deberíamos tener todos los binarios generados. Para comprobarlo, podemos ejecutar el siguiente comando: `ls build/bin`. Deberíamos obtener una salida similar a ésta: 
```bash
$ ls build/bin        
bitcoin  bitcoin-cli  bitcoin-node  bitcoin-tx  bitcoin-util  bitcoin-wallet  bitcoind  test_bitcoin
```
Es importante tener en cuenta que C++ es un lenguaje compilado, no interpretado. Esto significa que cada vez que realicemos un cambio en el código fuente, deberemos recompilar el proyecto (repitiendo el paso 4) para que los cambios se reflejen en los binarios, aunque no se indique explícitamente más adelante. 


## Nuestro primer log
En esta guía ejecutaremos nuestro nodo en `regtest`, ya que esta red nos permite disponer de un entorno local completamente bajo nuestro control. Comenzaremos lanzando el nodo en dicha red con el siguiente comando: 
```bash
./build/bin/bitcoind -regtest   
``` 
Al ejecutarlo, se mostrarán numerosos mensajes de log que, por el momento, no son relevantes. Para comprobar que el nodo está funcionando correctamente y que podemos comunicarnos con él, ejecutamos el siguiente comando en otro terminal: 
```
./build/bin/bitcoin-cli --regtest getblockchaininfo  
```
Esto debería devolver un objeto JSON con información sobre el estado de la red: 
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
Si es la primera vez que utilizamos esta red, el campo *blocks* deberá indicar 0; en caso contrario, el valor será mayor. 

En este punto hemos realizado una llamada RPC a nuestro nodo. A continuación, añadiremos nuestro primer log personalizado para aprender cómo instrumentar el código y seguir la ejecución de forma más detallada. 

Para ello, abrimos el archivo `src/rpc/blockchain.cpp` y localizamos la función `getblockchaininfo` (en torno a la línea 1335). Ésta es la función que se ejecuta cuando realizamos la llamada RPC anterior. Añadiremos nuestro log al inicio de la función, de manera que el código quede así: 

```c++
// used by rest.cpp:rest_chaininfo, so cannot be static
RPCHelpMan getblockchaininfo()
{
	//AÑADIR esta linea
    LogDebug(BCLog::RPC, "MI PRIMER LOG");

    return RPCHelpMan{"getblockchaininfo",...
```

Tras realizar este cambio, debemos recompilar y volver a ejecutar el nodo. En esta ocasión, añadimos el flag `-debug=rpc` para que se muestre nuestro mensaje de log:
```bash
cmake --build build -j "$(($(nproc)/2+1))"  
./build/bin/bitcoind -regtest -debug=rpc
```
Una vez iniciado el nodo, volvemos a invocar `getblockchaininfo`. Deberíamos ver el mensaje de log en el terminal. En ocasiones, el nodo continúa imprimiendo mensajes, por lo que resulta fácil perder la traza de nuestro log. Si deseamos continuar una versión persistente de los registros, podemos acceder al archivo  `~/.bitcoin/regtest/debug.log`. Para verificar que nuestro mensaje se encuentra ahí, ejecutamos: 
```bash
$ cat ~/.bitcoin/regtest/debug.log| grep "MI PRIMER LOG"
2025-12-12T23:22:31Z [rpc] MI PRIMER LOG
```

Cabe destacar que el sistema de logging de Bitcoin Core ha mejorado notablemente en las últimas versiones. Actualmente permite clasificar los mensajes por categorías, lo que facilita enormemente el análisis. Por ese motivo hemos utilizado  `BCLog::RPC` como primer argumento de la función `LogDebug`. Durante el proceso de depuración podemos usar la categoría que prefiramos; solo tenemos que acordarnos de habilitarla al iniciar `bitcoind` en el flag `-debug`.

## Nuestro primer *breakpoint*

Ya hemos aprendido a añadir logs en Bitcoin Core, lo cual en muchos casos es suficiente. Sin embargo, hay situaciones en las que se requiere una depuración más precisa. Para ello, utilizaremos `gdb`. 

Para que la depuración funcione correctamente, es fundamental que el código se haya compilado sin optimizaciones. Tenemos que asegurarnos de haber utilizado el flag `-DCMAKE_BUILD_TYPE=Debug`:
```
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j "$(($(nproc)/2+1))"   
``` 
Para iniciar el depurador, ejecutamos: 
```bash
gdb ./build/bin/bitcoind   
```
Esto abrirá una sesión interactiva de depuración. En esta guía no entraremos en un uso exhaustivo de `gdb`; nos limitaremos a cubrir los conceptos básicos necesarios. 

Antes de iniciar la ejecución del programa, debemos establecer un *breakpoint*, es decir, un punto en el que el programa se detendrá para permitirnos inspeccionar su estado. En este ejemplo, lo colocaremos en la misma ruta de ejecución que antes. Dado que la función `getblockchaininfo`devuelve un objeto `RPCHelpMan`, utilizaremos el siguiente comando, con una salida similar a: 
```gdb
$ break RPCHelpMan::HandleRequest

Breakpoint 1 at 0x3aa2f5: file ./rpc/blockchain.cpp, line 1337.
```

Una vez definido el *breakpoint*, iniciamos la ejecución del programa:
```
run --regtest
```
A continuación, desde otro terminal, invocamos la llamada RPC `getblockchaininfo`. El depurador se detendrá y mostrará una salida similar a ésta: 
```
Thread 4 "b-httpworker.0" hit Breakpoint 1, RPCHelpMan::HandleRequest (
    this=0x7fffe3ffd300, request=...) at ./rpc/util.cpp:636
```
En este punto, podremos inspecionar el estado del programa. Observando el código fuente, veremos que la información relevante se encuentra en la variable `request`. Para mostrar el método RPC invocado, ejecutamos: 
```bash
$ print request.strMethod
```
La salida debería ser:`	2 = "getblockchaininfo"`. 

De este modo, hemos logrado ejecutar el programa, detener su flujo de ejecución e inspeccionar variables internas en tiempo de ejecución.

## ¿Cuándo se obtiene el número de bloques?
A continuación propongo un pequeño ejercicio: utilizando el comando `print`de `gdb`, muestra por pantalla la altura de la blockchain dentro de la función `getblockchaininfo()` del archivo `src/rpc/blockchain.cpp`.  Intenta resolverlo por tu cuenta antes de consultar la solución.

### Solución
Si entendiste el proceso de depuración, habrás seguido estos pasos: 
1. Abrir el archivo `src/rpc/blockchain.cpp` y localizar la función  `getblockchaininfo` (en torno a la línea 1335).
2. Identificar que se inicializa una variable llamada `height` en la línea 1383.
3. Iniciar el depurador. 
4. Establecer un *breakpoint* en la línea inmediatamente posterior a la asignación del valor: `break src/rpc/blockchain.cpp:1384`.
5. Ejecutar el programa con `run --regtest`.
6. Desde otro terminal, realizar la llamada RPC: `./build/bin/bitcoin-cli --regtest getblockchaininfo`.
7. Una vez alcanzado el *breakpoint*, imprimir el valor de la variable: `print height`.

>[!warning]
>Desde que Bitcoin Core migró su sistema de compilación de *autotools* a CMake, la depuración presenta ciertos problemas (ver [#31204](https://github.com/bitcoin/bitcoin/issues/31204)). Como solución temporal, ejecuta el siguiente comando dentro de `gdb`:
>```
>set substitute-path /home/arejula27/workspaces/bitcoin/build/src /home/arejula27/workspaces/bitcoin/src
>```
> Sustituye `/home/arejula27/workspaces/bitcoin` por ruta en la que hayas clonado el repositorio de Bitcoin Core en tu sistema. 

## Más *breakpoints*
Vamos a realizar un segundo ejercicio para consolidar los conceptos aprendidos. El objetivo es colocar un *breakpoint* en el archivo `src/init.cpp` que solo se active cuando el flag`-txindex` se utilice al iniciar *bitcoind*.

>[!warning]
>El flag `-txindex` puede activarse tanto desde la línea de comandos al iniciar `bitcoind` como a través del archivo de configuración de Bitcoin Core. Para este ejercicio, se recomienta eliminarlo del archivo de configuración y activarlo o desactivarlo únicamente desde la CLI. 
### Solución
Si has analizado el código con atención, habrás observado la existencia de una variable `args`que instancia un objeto de tipo `ArgsManager`. A través de esta clase se gestionan y consultan los flags proporcionados al iniciar el nodo. 

En este caso, nos interesaba comprobar si el flag  `txindex` estaba habilitado. Existen varias secciones del código donde se realiza esta comprobación; una de ellas se encuentra alrededor de la línea 1848 del archivo `src/init.cpp`: 
```c++
    if (args.GetBoolArg("-txindex", DEFAULT_TXINDEX)) {
        g_txindex = std::make_unique<TxIndex>(interfaces::MakeChain(node), index_cache_sizes.tx_index, false, do_reindex);
        node.indexes.emplace_back(g_txindex.get());
    }

```
Si colocaste un *breakpoint* en esta sección, por ejemplo en la línea 1848: (`break init.cpp:1848`), el breakpoing solo se habría activado cuando ejecutases `bitcoind`con el flag `-txindex` habilitado, por ejemplo: 
```bash
gdb --args ./build/bin/bitcoind -regtest  -txindex
``` 
 De este modo, pudiste verificar cómo el flujo de ejecución dependía directamente de la configuración proporcionada al nodo. 

## Depurar los test unitarios
En Bitcoin Core existen distintos tipos de test: tests unitarios, tests funcionales y tests de fuzzing. En este apartado nos centraremos en los tests unitarios. 

Los tests unitarios están escritos en C++ y verifican el comportamiento de funciones y componentes concretos del sistema. Todos ellos se agrupan en un único binario llamado `test_bitcoin`. Estos tests están implementados utilizando la librería **BOOST**, que dispone de su propio sistema de logging. 

Como ejemplo, podemos ejecutar el test `getarg`, que valida el comportamiento de la clase encargada de gestionar la configuración de *bitcoind* (`GetArgs`):
```bash
build/bin/test_bitcoin --log_level=all --run_test=getarg_tests 
```
En este comando, hemos indicado que se muestre todo el nivel de logging (*all*), aunque también es posible especificar otros niveles más restrictivos, como: `test_suite`, `message` , `warning` y `error`.

Para imprimir mensajes personalizados desde los tests, debemos utilizar las macros de logging proporcionadas por Boost. En cambio, si queremos imprimir mensajes desde el código fuente que está siendo probado (no desde el test en sí), es recomendable escribir directamente en la salida de error estándar. Por ejemplo: 
```c++
//dentro de los test
BOOST_TEST_MESSAGE("=======MY BOOST LOG=============");
//dentro del código
fprintf(stderr, "=======MY BOOST LOG FROM THE CODE====");
```

Si deseamos ver únicamente los mensajes definidos en los test, podemos utilizar el nivel de log `--log_level=message `. Si, por el contrario, solo nos interesa la salida de error, utilizamos: `--log_level=error `.

Para comprobar el funcionamiento del logging, modificamos la línea 62 del archivo `src/test/getargs_test.cpp` de la siguiente forma: 
```c++
BOOST_AUTO_TEST_CASE(setting_args)
{
    ArgsManager args;
    SetupArgs(args, {{"-foo", ArgsManager::ALLOW_ANY}});
	// añade esta linea
    BOOST_TEST_MESSAGE("=======MY BOOST LOG=============");

```
A continuación, recompilamos el proyecto y ejecutamos el test: 
```bash
cmake --build build -j "$(($(nproc)/2+1))" 
build/bin/test_bitcoin --log_level=message --run_test=getarg_tests
```
Deberíamos ver en la salida el mensaje de log que acabamos de añadir.

También es posible depurar los test unitarios utilizando `gdb`. El procedimiento es exactamente el mismo que el descrito anteriormente: compilar sin optimizaciones, iniciar `gdb` apuntando al binario `test_bitcoin`, establecer los *breakpoints* necesarios y ejecutar el test correspondiente. Dado que el flujo no difiere del ya explicado, no lo repetiremos en detalle. 

## Depurar los test funcionales 
Los tests funcionales en Bitcoin Core están escritos en Python y verifican el comportamiento del sistema completo, a diferencia de los tests unitarios, que se centran en funciones o componentes aislados. Para ello, los tests funcionales crean instancias de varios nodos y validan su interacción a nivel de red, incluyendo aspectos como RPC, consenso, mempool, wallet y compunicación P2P, entre otros. 

Dado que estos tests no están escritos en C++, no pueden depurarse directamente con `gdb` de la misma forma que el código del nodo o los tests unitarios. 

Para ejecutar la suite completa de tests funcionales, podemos utilizar el siguiente comando: 

```bash
build/test/functional/test_runner.py --extended
```
Este proceso puede tardar bastante tiempo. Si deseamos ejecutar uno o varios tests concretos, podemos especificarlos por nombre utilizando el script `test_runner.py` :
```
build/test/functional/test_runner.py feature_rbf.py

```
Durante la ejecución, los logs se esriben en el archivo `test_framework.log`, ubicado dentro del directorio temporal asignado al test. La ruta exacta se muestra en la primera línea de salida al ejecutar el script. 

Por defecto, este directorio se elimina automáticamente cuando el test finaliza correctamente. Si deseasmos conservarlo para su análisis, podemos evitar este comportamiento utilizando el flag `--nocleanup`. En mi caso, el archivo se generó en la siguiente ruta: `/tmp/test_runner_₿_🏃_20251214_162745/feature_rbf_0/test_framework.log`. 

Si deseamos ver los logs directamente en el terminal para un test concreto, podemos ejecutar el archivo del test como si fuera un script independiente: 
```bash
build/test/functional/feature_rbf.py --loglevel=info
```
Para ajustar el nivel de detalle del logging, podemos utilizar el flag `--loglevel=info`. Dentro del propio código, podemos añadir mensajes de log personalizados de la siguiente forma: 
```
self.log.info("foo")
self.log.debug("bar")
```

Además, existe la posibilidad de mostrar todos los mensajes generados por las llamadas RPC. Esta opción es muy verbosa, por lo que debe usarse con precaución. Para activarla, utilizamos el flag `--tracerpc`.  

Finalmente, veremos cómo depurar test funcionales combinando herramientas de Python y C++. 

Dado que los tests están escritos en Python, no podemos iniciarlos directamente desde `gdb`. En su lugar, detendremos la ejecución desde Python y nos conectaremos al proceso del nodo en C++.

Para detener la ejecución del test, añadimos la siguiente línea en el punto donde queramos pausar el flujo: 
```python
import pdb; pdb.set_trace()
```

En nuestro ejemplo, editamos el archivo `test/functional/feature_rbf.py` en la línea 28, quedando así:
```python
import pdb; pdb.set_trace()
class ReplaceByFeeTest(BitcoinTestFramework):
```

A continuación, compilamos sin optimizaciones:
```
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j "$(($(nproc)/2+1))"   
```

Ahora ejecutamos el test directamente (sin usar el *test runner*). Si todo está configurado correctamente, veremos una salida similar a la siguiente: 
```
$ ./build/test/functional/feature_rbf.py
> /home/arejula27/workspaces/bitcoin/build/test/functional/feature_rbf.py(28)<module>()
-> pdb.set_trace()
(Pdb)
```
Esto indica que el test está detenido y esperando instrucciones en el depurador de Python (`pdb`). 

Mientras el test está detenido, conectamos `gdb` al proceso de `bitcoind` que ha sido lanzado por el test (o lo iniciamos previamente, según el caso), y establecemos un *breakpoint* en el código fuente C++ que será ejecutado. 

En este caso, el test realiza una llamada RPC a `sendrawtransaction`. Supongams que queremos inspeccionar el cálculo del tamaño virtual de la transacción: para ello, colocamos un *breakpoint* en el archivo `b src/rpc/mempool.cpp:96` y le damos a continuar tanto en *gdb* como  en *pdb*. Entonces veremos algo similar a esto: 
```
(gdb) c
Continuing.
[Switching to Thread 0x7f40077fe6c0 (LWP 13012)]

Thread 7 "b-httpworker.0" hit Breakpoint 1, operator() (__closure=0x7f40077fc320, self=..., request=...) at ./rpc/mempool.cpp:96
96                  CAmount max_raw_tx_fee = max_raw_tx_fee_rate.GetFee(virtual_size);

```
En este punto, ya nos encontramos detenidos en el código C++, y podemos inspeccionar las variables como hemos hecho anteriormente: 
```
(gdb) p virtual_size
$1 = 147
```

## Conclusión
Bitcoin Core es un proyecto complejo, y localizar el punto exacto donde se produce un fallo puede resultar una tarea muy tediosa. En muchos casos, los propios logs del programa son suficientes; sin embargo, en otras situaciones es necesario realizar un análisis más profundo. 

En esta guía hemos aprendido a añadir nuestros propios logs tanto en el nodo como en los tests, así como a utilizar herramientas de depuración para inspeccionar la ejecución paso a paso. Cuando los logs no son suficientes y se requiere analizar el comportamiento línea por línea, el uso de un depurador se convierte en una herramienta imprescindible. 

## Sources
- [fjahr/bitcoin_debugging.md](https://gist.github.com/fjahr/2cd23ad743a2ddfd4eed957274beca0f)
- [Debugging Bitcoin Core Workshop](https://gist.github.com/fjahr/5bf65daaf9ff189a0993196195005386)
- https://github.com/bitcoin/bitcoin/blob/master/doc/build-unix.md
- https://github.com/bitcoin/bitcoin/blob/master/doc/developer-notes.md
- https://github.com/bitcoin/bitcoin/blob/master/test/README.md
