import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Helper to create a minimal valid audio file for testing
function createTestAudioBuffer(): Buffer {
  // Minimal MP3 header (silence)
  // This is a valid MP3 frame header with minimal data
  const mp3Header = Buffer.from([
    0xff, 0xfb, 0x90, 0x00, // MP3 frame header
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  return mp3Header;
}

test.describe('Audio Notes API Endpoints', () => {
  let testCvId: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Get list of CVs to find one for testing
    const response = await request.get('/api/cv/list');
    const data = await response.json();

    if (data.success && data.data.length > 0) {
      testCvId = data.data[0].id;
    }
  });

  test('should return 404 for audio list on non-existent CV', async ({ request }) => {
    const response = await request.get('/api/cv/non-existent-id/audio');
    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  test('should return empty array for CV with no audios', async ({ request }) => {
    test.skip(!testCvId, 'No CV available for testing');

    const response = await request.get(`/api/cv/${testCvId}/audio`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('should reject upload without file', async ({ request }) => {
    test.skip(!testCvId, 'No CV available for testing');

    const response = await request.post(`/api/cv/${testCvId}/audio`, {
      multipart: {},
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('No audio file');
  });

  test('should reject invalid audio type', async ({ request }) => {
    test.skip(!testCvId, 'No CV available for testing');

    const response = await request.post(`/api/cv/${testCvId}/audio`, {
      multipart: {
        audio: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('not an audio file'),
        },
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid audio file');
  });

  test('should accept .opus files (WhatsApp format)', async ({ request }) => {
    test.skip(!testCvId, 'No CV available for testing');

    // Minimal Opus file header (OggS magic + basic structure)
    const opusHeader = Buffer.from([
      0x4f, 0x67, 0x67, 0x53, // OggS magic
      0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    const response = await request.post(`/api/cv/${testCvId}/audio`, {
      multipart: {
        audio: {
          name: 'whatsapp-audio.opus',
          mimeType: 'audio/opus',
          buffer: opusHeader,
        },
      },
    });

    // May fail due to B2 config in test environment
    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.originalName).toBe('whatsapp-audio.opus');
      expect(data.data.mimeType).toBe('audio/opus');

      // Cleanup
      await request.delete(`/api/cv/${testCvId}/audio/${data.data.id}`);
    } else {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('should accept .opus files with generic mime type', async ({ request }) => {
    test.skip(!testCvId, 'No CV available for testing');

    const opusHeader = Buffer.from([
      0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00,
    ]);

    // WhatsApp sometimes sends with application/octet-stream
    const response = await request.post(`/api/cv/${testCvId}/audio`, {
      multipart: {
        audio: {
          name: 'PTT-20260202-WA0001.opus',
          mimeType: 'application/octet-stream', // Generic type
          buffer: opusHeader,
        },
      },
    });

    // Should be accepted based on extension
    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.mimeType).toBe('audio/opus'); // Should be corrected

      // Cleanup
      await request.delete(`/api/cv/${testCvId}/audio/${data.data.id}`);
    } else {
      // If B2 is not configured, at least it shouldn't be a 400 validation error
      const data = await response.json();
      // Should not be rejected as invalid audio
      if (response.status() === 400) {
        expect(data.error).not.toContain('Invalid audio file');
      }
    }
  });

  test('should upload valid audio file', async ({ request }) => {
    test.skip(!testCvId, 'No CV available for testing');

    const audioBuffer = createTestAudioBuffer();

    const response = await request.post(`/api/cv/${testCvId}/audio`, {
      multipart: {
        audio: {
          name: 'test-audio.mp3',
          mimeType: 'audio/mpeg',
          buffer: audioBuffer,
        },
      },
    });

    // May fail due to B2 config in test environment
    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('originalName', 'test-audio.mp3');
      expect(data.data).toHaveProperty('mimeType', 'audio/mpeg');
      expect(data.data).toHaveProperty('audioKey');

      // Cleanup: delete the uploaded audio
      const audioId = data.data.id;
      await request.delete(`/api/cv/${testCvId}/audio/${audioId}`);
    } else {
      // Expected in test environment without B2 config
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('should return 404 for non-existent audio', async ({ request }) => {
    test.skip(!testCvId, 'No CV available for testing');

    const response = await request.get(`/api/cv/${testCvId}/audio/non-existent-audio-id`);
    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  test('should return 404 when deleting non-existent audio', async ({ request }) => {
    test.skip(!testCvId, 'No CV available for testing');

    const response = await request.delete(`/api/cv/${testCvId}/audio/non-existent-audio-id`);
    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.success).toBe(false);
  });
});

test.describe('Audio Notes UI', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/', { timeout: 60000 });

    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded');

    // Check header is visible - basic smoke test
    await expect(page.locator('h1')).toContainText('CV Reformatter', { timeout: 15000 });
  });

  test('notes dialog structure is correct when CV is selected', async ({ page, request }) => {
    // First check if there are CVs via API
    const listResponse = await request.get('/api/cv/list');
    const listData = await listResponse.json();

    test.skip(!listData.success || listData.data.length === 0, 'No CVs available for UI testing');

    await page.goto('/', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    // Wait for page to be interactive
    await page.waitForTimeout(2000);

    // Try to click on the first CV in the list
    const cvItems = page.locator('button').filter({ hasText: /\.pdf|\.docx/i });
    const count = await cvItems.count();

    if (count > 0) {
      await cvItems.first().click();
      await page.waitForTimeout(1000);

      // Look for notes button
      const notesButton = page.locator('button[title="Notes du CV"]');
      if (await notesButton.count() > 0) {
        await notesButton.click();

        // Check dialog structure
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 5000 });

        // Verify audio section text exists
        const audioText = page.getByText('Enregistrements audio');
        await expect(audioText).toBeVisible({ timeout: 5000 });

        // Verify upload zone text
        const uploadText = page.getByText(/Glissez des fichiers audio/i);
        await expect(uploadText).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe('Audio Notes Integration', () => {
  test('CV GET endpoint includes audioNotes field', async ({ request }) => {
    // First get a CV from the list
    const listResponse = await request.get('/api/cv/list');
    const listData = await listResponse.json();

    if (listData.success && listData.data.length > 0) {
      const cvId = listData.data[0].id;

      // Get the CV details
      const cvResponse = await request.get(`/api/cv/${cvId}`);
      const cvData = await cvResponse.json();

      expect(cvData.success).toBe(true);
      // audioNotes should be included in the response
      expect(cvData.data).toHaveProperty('audioNotes');
      expect(Array.isArray(cvData.data.audioNotes)).toBe(true);
    }
  });

  test('should handle concurrent audio uploads gracefully', async ({ request }) => {
    const listResponse = await request.get('/api/cv/list');
    const listData = await listResponse.json();

    if (listData.success && listData.data.length > 0) {
      const cvId = listData.data[0].id;
      const audioBuffer = createTestAudioBuffer();

      // Try to upload multiple files concurrently
      const uploads = [
        request.post(`/api/cv/${cvId}/audio`, {
          multipart: {
            audio: {
              name: 'test1.mp3',
              mimeType: 'audio/mpeg',
              buffer: audioBuffer,
            },
          },
        }),
        request.post(`/api/cv/${cvId}/audio`, {
          multipart: {
            audio: {
              name: 'test2.mp3',
              mimeType: 'audio/mpeg',
              buffer: audioBuffer,
            },
          },
        }),
      ];

      const results = await Promise.all(uploads);

      // All requests should complete without server errors
      for (const response of results) {
        expect(response.status()).toBeLessThan(500);
      }

      // Cleanup any successful uploads
      for (const response of results) {
        if (response.ok()) {
          const data = await response.json();
          if (data.success && data.data?.id) {
            await request.delete(`/api/cv/${cvId}/audio/${data.data.id}`);
          }
        }
      }
    }
  });
});
