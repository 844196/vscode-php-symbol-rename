import { ExtensionContext, languages } from 'vscode';
import { PhpRenameProvider } from './rename-provider';

const activate = (ctx: ExtensionContext) => {
  ctx.subscriptions.push(languages.registerRenameProvider('php', new PhpRenameProvider()));
  console.log('vscode-php-symbol-rename is active');
};

const deactivate = () => undefined;

export { activate, deactivate };
