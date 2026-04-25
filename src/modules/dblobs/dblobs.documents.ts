import { convert_Blob_To_Base64 } from '~/common/util/blobUtils';

import { _addDBAsset, gcDBAssetsByScope, getDBAsset } from './dblobs.db';
import { _createAssetObject, DBlobAssetId, DBlobAssetType, DBlobDBContextId, DBlobDBScopeId, DBlobDocumentAsset, DBlobMimeType } from './dblobs.types';


// configuration


export async function addDBDocumentAsset(
  scopeId: DBlobDBScopeId,
  documentBlob: Blob,
  document: {
    label: string,
    origin: DBlobDocumentAsset['origin'],
    metadata: DBlobDocumentAsset['metadata'],
  },
): Promise<DBlobAssetId> {

  // Blob -> base64
  const base64Data = await convert_Blob_To_Base64(documentBlob, 'addDBDocumentAsset');
  const documentType = documentBlob.type; // We assume the mime type is supported (checked by caller or TS)

  const assetData: DBlobDocumentAsset['data'] = {
    base64: base64Data,
    mimeType: documentType as any,
  };

  // create the document asset object
  const documentAsset = _createAssetObject(
    DBlobAssetType.DOCUMENT,
    document.label,
    assetData,
    document.origin,
    document.metadata,
  );

  // DB add
  return _addDBAsset<typeof documentAsset>(documentAsset, 'global', scopeId);
}


// R

export async function getDocumentAsset(id: DBlobAssetId) {
  return await getDBAsset<DBlobDocumentAsset>(id);
}


// D

export async function gcDBDocumentAssets(contextId: DBlobDBContextId, scopeId: DBlobDBScopeId, keepIds: DBlobAssetId[]) {
  await gcDBAssetsByScope(contextId, scopeId, DBlobAssetType.DOCUMENT, keepIds);
}
