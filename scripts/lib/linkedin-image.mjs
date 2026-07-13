export async function uploadImageToLinkedIn({ token, ownerUrn, imageBuffer }) {
  if (!token) throw new Error('LinkedIn upload error: token is required');
  if (!ownerUrn) throw new Error('LinkedIn upload error: ownerUrn is required');
  if (!imageBuffer) throw new Error('LinkedIn upload error: imageBuffer is required');

  // Step 1: Register the upload
  const registerUrl = 'https://api.linkedin.com/v2/assets?action=registerUpload';
  const registerPayload = {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: ownerUrn,
      serviceRelationships: [
        {
          relationshipType: 'OWNER',
          identifier: 'urn:li:userGeneratedContent'
        }
      ]
    }
  };

  const registerRes = await fetch(registerUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(registerPayload)
  });

  if (!registerRes.ok) {
    const errText = await registerRes.text();
    throw new Error(`LinkedIn registerUpload failed: ${registerRes.status} ${registerRes.statusText} - ${errText}`);
  }

  const registerData = await registerRes.json();
  
  const uploadMechanism = registerData.value?.uploadMechanism;
  const mediaUploadHttpRequest = uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
  const uploadUrl = mediaUploadHttpRequest?.uploadUrl;
  const asset = registerData.value?.asset;

  if (!uploadUrl || !asset) {
    throw new Error(`LinkedIn registerUpload returned invalid structure: ${JSON.stringify(registerData)}`);
  }

  // Step 2: Upload raw image bytes
  let uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/png'
    },
    body: imageBuffer
  });

  if (uploadRes.status === 400 || uploadRes.status === 405) {
    // Retry as POST
    uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png'
      },
      body: imageBuffer
    });
  }

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`LinkedIn image binary upload failed: ${uploadRes.status} ${uploadRes.statusText} - ${errText}`);
  }

  return asset;
}
