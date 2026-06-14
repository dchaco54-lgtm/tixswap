import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL, fileURLToPath } from "node:url";

function buildSyntheticModule(identifier, exportsObject) {
  const exportNames = Object.keys(exportsObject);
  return new vm.SyntheticModule(exportNames, function init() {
    for (const name of exportNames) {
      this.setExport(name, exportsObject[name]);
    }
  }, { identifier });
}

function resolveLocalSpecifier(specifier, referencingIdentifier) {
  const basePath = fileURLToPath(referencingIdentifier);
  return pathToFileURL(path.resolve(path.dirname(basePath), specifier)).href;
}

export async function loadModule(modulePath, options = {}) {
  const { stubs = {} } = options;
  const cache = new Map();

  async function instantiate(identifier) {
    if (cache.has(identifier)) return cache.get(identifier);

    if (Object.prototype.hasOwnProperty.call(stubs, identifier)) {
      const synthetic = buildSyntheticModule(identifier, stubs[identifier]);
      cache.set(identifier, synthetic);
      return synthetic;
    }

    const filePath = fileURLToPath(identifier);
    const source = await fs.readFile(filePath, "utf8");
    const module = new vm.SourceTextModule(source, {
      identifier,
      initializeImportMeta(meta) {
        meta.url = identifier;
      },
    });

    cache.set(identifier, module);

    await module.link(async (specifier, referencingModule) => {
      if (Object.prototype.hasOwnProperty.call(stubs, specifier)) {
        const syntheticId = `stub:${specifier}`;
        if (!cache.has(syntheticId)) {
          cache.set(syntheticId, buildSyntheticModule(syntheticId, stubs[specifier]));
        }
        return cache.get(syntheticId);
      }

      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        return instantiate(
          resolveLocalSpecifier(specifier, referencingModule.identifier)
        );
      }

      throw new Error(`No hay stub para import externo: ${specifier}`);
    });

    await module.evaluate();
    return module;
  }

  const rootIdentifier = pathToFileURL(path.resolve(modulePath)).href;
  const module = await instantiate(rootIdentifier);
  return module.namespace;
}
