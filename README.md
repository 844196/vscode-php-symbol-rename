# PHP Symbol Rename

## Development

### Install

```shell
# install programs
sudo apt install npm webpack
sudo npm install -g npx

# install dependencies
npm install
```

### Debug 

Hit F5 to run and debug the extension (it opens a new VS Code window)

## Build

```shell
# build extension
npm run-script build
# build package
npx vsce package
```

### TODO

* [ ] vendor path consider `composer.json['config']['vendor-dir']`
