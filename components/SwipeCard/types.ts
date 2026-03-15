export interface Profile {
  id: string;
  name: string;
  age: number;
  bio?: string;
  photos: string[];          // ordered, first = primary
  city?: string;
  nationality?: string;
  distance?: number;         // km
  verified?: boolean;
  online?: boolean;
  interests?: string[];
  height?: number;           // cm
  occupation?: string;
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'super';

export interface SwipeResult {
  profileId: string;
  direction: SwipeDirection;
  timestamp: number;
}

export interface SwipeCardProps {
  profile: Profile;
  /** 0 = top of stack, increases going back */
  stackIndex: number;
  onSwipe: (result: SwipeResult) => void;
  /** Whether this resulted in a mutual like */
  isMatch?: boolean;
  /** The current user's photo — shown in match animation */
  currentUserPhoto?: string;
  className?: string;
}

export interface SwipeDeckProps {
  profiles: Profile[];
  onSwipe: (result: SwipeResult) => void;
  onEmpty?: () => void;
  currentUserPhoto?: string;
  /** Number of cards to pre-render behind top card */
  stackDepth?: number;
}
