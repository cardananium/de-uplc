import * as vscode from 'vscode';
import { DataProvider } from './data-provider.interface';
import { KoiosClient } from './koios-client';
import { FileProvider } from './file-provider';

let onlineProvider: DataProvider | undefined;
let offlineProvider: DataProvider | undefined;

function getWorkspaceFolderFallback(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

function readSettings() {
  const cfg = vscode.workspace.getConfiguration('deuplc.providers');
  const apiKey = cfg.get<string>('koios.apiKey') || undefined;
  const timeout = cfg.get<number>('timeout') ?? 30000;
  const retryAttempts = cfg.get<number>('retryAttempts') ?? 3;
  const offlineEnabled = cfg.get<boolean>('offline.enabled') ?? false;
  const offlinePath = cfg.get<string>('offline.filePath');

  return {
    apiKey,
    timeout,
    retryAttempts,
    offlineEnabled,
    offlinePath,
  };
}

function buildOnlineProvider() : DataProvider {
  const settings = readSettings();
  return new KoiosClient({
    apiKey: settings.apiKey,
    timeout: settings.timeout,
    retryAttempts: settings.retryAttempts,
  });
}

function buildOfflineProvider(): DataProvider {
  const settings = readSettings();
  const folder = getWorkspaceFolderFallback();
  const defaultPath = folder ? `${folder}/deuplc-offline.json` : 'deuplc-offline.json';
  const filePath = settings.offlinePath && settings.offlinePath.trim().length > 0 ? settings.offlinePath : defaultPath;
  return new FileProvider({ filePath });
}

export function registerDataProviders(context: vscode.ExtensionContext) {
  // Initial build
  onlineProvider = buildOnlineProvider();
  offlineProvider = buildOfflineProvider();

  // Rebuild providers on configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((evt) => {
      if (evt.affectsConfiguration('deuplc.providers')) {
        onlineProvider = buildOnlineProvider();
        offlineProvider = buildOfflineProvider();
      }
    })
  );
}

export function getOnlineProvider(): DataProvider {
  if (!onlineProvider) {
    onlineProvider = buildOnlineProvider();
  }
  return onlineProvider;
}

export function getOfflineDataProvider(): DataProvider {
  if (!offlineProvider) {
    offlineProvider = buildOfflineProvider();
  }
  return offlineProvider;
}

export function getProviders() {
  return {
    dataProvider: getOnlineProvider(),
    offlineDataProvider: getOfflineDataProvider(),
  };
}