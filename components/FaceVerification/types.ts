export interface FaceVerificationResult {
  verified: boolean;
  confidence: number;
  livenessScore: number;
}

export type LivenessCheckType = 'blink' | 'headturn' | 'smile';

export type VerificationStep =
  | 'idle'
  | 'positioning'
  | 'blink'
  | 'headturn'
  | 'smile'
  | 'capturing'
  | 'verifying'
  | 'success'
  | 'failed';

export interface FaceData {
  rollAngle: number;
  yawAngle: number;
  smilingProbability: number;
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  bounds: {
    origin: { x: number; y: number };
    size: { width: number; height: number };
  };
}

export interface LivenessState {
  blinkDetected: boolean;
  headTurnDetected: boolean;
  smileDetected: boolean;
  passedChecks: number;
  livenessScore: number;
}

export type HeadTurnPhase = 'idle' | 'left' | 'right' | 'done';

export interface AntiSpoofResult {
  passed: boolean;
  reason?: string;
}

export interface FaceVerificationProps {
  /** URI of the user's uploaded profile photo to compare against */
  profilePhotoUri: string;
  onVerified: (result: FaceVerificationResult) => void;
  onError?: (error: Error) => void;
  awsConfig: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
  highContrastMode?: boolean;
}
