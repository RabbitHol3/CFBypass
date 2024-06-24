# CFBypass 

Esse é um caso de estudo de um bypass para o sistema de Cookies da Cloudflare, que é um serviço de segurança que protege sites de ataques DDoS, mas que também pode ser usado para proteger sites de scraping.

## Objetivo

O objetivo desse projeto é estudar como o Cloudflare protege sites de scraping e como é possível burlar essa proteção, e conseguir fazer scrapping por meio de requisições HTTP/HTTPS.

## Como funciona

É HTTP para o site alvo, e o Cloudflare retorna um desafio que é um HTML com um script que executa um desafio de JavaScript.

Leia a função `getCloudflareCookies` no arquivo `cf_bypasser.js` para entender melhor como o bypass funciona.

## Como é feito o bypass

1. Capturamos o valor de `key` e `s` contidos dentro do site alvo
2. Capturamos o header `Cf-Ray` utilizando puppeter
3. Utilizamos os dados do site `baseData` e `key` para resolver o desafio e obter o valor de `wp`
4. utilizamos `Cf-Ray` para montar o url alvo para fazer a requisição com o valor de `wp` e `s` o retorno é o cookie da sessão

## Limitações

Por enquanto não consegui retornar o header `Cf-Ray` sem usar o Puppeteer, então o bypass ainda depende do Puppeteer para funcionar.


## Ferramentas

- NodeJS
- Puppeteer

## Execução

Primeiro instale as dependências nodejs:

```bash
npm install
```

Depois execute o script:

```bash
node main.js
```

