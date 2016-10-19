A collection of utility libraries used by huoguan.net's products.

要正常使用此类库，一定记得要在 module 的代码里引入 babel-polyfill  
要不然一些功能，例如 Symbol（相关的 for of...）在一些环境下（例如 iOS 8）无法使用，会导致出错。  
此类库虽然把它加入了依赖，但并没有在代码里引入它，要由使用者自行引入。
