import { CompareFacesCommand, RekognitionClient } from '@aws-sdk/client-rekognition';
import { useCallback, useRef } from 'react';

interface AWSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

interface CompareResult {
  verified: boolean;
  confidence: number;
}

const SIMILARITY_THRESHOLD = 80;
const MIN_RESOLUTION_PX    = 720;

export function useAWSRekognition(config: AWSConfig) {
  const clientRef = useRef<RekognitionClient | null>(null);

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new RekognitionClient({
        region: config.region,
        credentials: {
          accessKeyId:     config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
    }
    return clientRef.current;
  }, [config.accessKeyId, config.secretAccessKey, config.region]);

  /** Fetch an image URL or data-URL and return its raw bytes */
  const readImageAsBytes = useCallback(async (uri: string): Promise<Uint8Array> => {
    const res  = await fetch(uri);
    const buf  = await res.arrayBuffer();
    return new Uint8Array(buf);
  }, []);

  const validateResolution = useCallback((width: number, height: number): boolean => {
    return Math.min(width, height) >= MIN_RESOLUTION_PX;
  }, []);

  const compareFaces = useCallback(
    async (
      capturedPhotoUri: string,
      profilePhotoUri: string,
      photoWidth: number,
      photoHeight: number,
    ): Promise<CompareResult> => {
      if (!validateResolution(photoWidth, photoHeight)) {
        throw new Error(
          `Camera resolution too low (${photoWidth}×${photoHeight}). Minimum 720p required.`,
        );
      }

      let capturedBytes: Uint8Array | null = null;
      let profileBytes:  Uint8Array | null = null;

      try {
        [capturedBytes, profileBytes] = await Promise.all([
          readImageAsBytes(capturedPhotoUri),
          readImageAsBytes(profilePhotoUri),
        ]);

        const command = new CompareFacesCommand({
          SourceImage:         { Bytes: capturedBytes },
          TargetImage:         { Bytes: profileBytes },
          SimilarityThreshold: SIMILARITY_THRESHOLD,
          QualityFilter:       'HIGH',
        });

        const response   = await getClient().send(command);
        const similarity = response.FaceMatches?.[0]?.Similarity ?? 0;

        return {
          verified:   similarity >= SIMILARITY_THRESHOLD,
          confidence: similarity / 100,
        };
      } finally {
        // Zero out buffers — never keep biometric data in memory
        capturedBytes?.fill(0);
        profileBytes?.fill(0);
      }
    },
    [validateResolution, readImageAsBytes, getClient],
  );

  return { compareFaces };
}
