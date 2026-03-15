// ─── Photo visibility ─────────────────────────────────────────────────────────

export type PhotoVisibility = 'public' | 'matches' | 'private';

export const VISIBILITY_META: Record<PhotoVisibility, { label: string; icon: string; description: string }> = {
  public:  { label: 'Public',        icon: '🌐', description: 'Anyone can see this photo' },
  matches: { label: 'Matches only',  icon: '💜', description: 'Visible after matching' },
  private: { label: 'Private',       icon: '🔒', description: 'Reveal to specific people' },
};

export interface ProfilePhoto {
  id:         string;
  user_id:    string;
  storage_key: string;
  order_index: number;
  visibility: PhotoVisibility;
  created_at: string;
}

// ─── Emergency contact ────────────────────────────────────────────────────────

export interface EmergencyContact {
  name:   string;
  phone:  string;
  email?: string;
}

// ─── Date check-in ────────────────────────────────────────────────────────────

export type CheckinStatus = 'pending' | 'safe' | 'alerted' | 'cancelled';

export interface DateCheckin {
  id:                string;
  user_id:           string;
  date_name:         string;
  date_location:     string;
  date_starts_at:    string;
  emergency_contact: EmergencyContact;
  checkin_prompt_at: string;
  checked_in_at:     string | null;
  alerted_at:        string | null;
  status:            CheckinStatus;
  created_at:        string;
}

export interface CreateCheckinPayload {
  dateName:          string;
  dateLocation:      string;
  dateStartsAt:      string;   // ISO
  emergencyContact:  EmergencyContact;
}

// ─── Safety tips content ──────────────────────────────────────────────────────

export interface SafetyTip {
  title:   string;
  icon:    string;
  content: string;
}

export interface RedFlag {
  title:       string;
  description: string;
}

export interface EmergencyNumber {
  country: string;
  police:  string;
  ambulance?: string;
  domestic_violence?: string;
  cyber_crime?: string;
}

export const GCC_EMERGENCY_NUMBERS: EmergencyNumber[] = [
  { country: '🇸🇦 Saudi Arabia', police: '999', ambulance: '911',  domestic_violence: '1919', cyber_crime: '1441' },
  { country: '🇦🇪 UAE',          police: '999', ambulance: '998',  domestic_violence: '800-SAFE (7233)', cyber_crime: '8008880' },
  { country: '🇶🇦 Qatar',        police: '999', ambulance: '999',  domestic_violence: '919' },
  { country: '🇰🇼 Kuwait',       police: '112', ambulance: '112',  domestic_violence: '147' },
  { country: '🇧🇭 Bahrain',      police: '999', ambulance: '999',  domestic_violence: '80008001' },
  { country: '🇴🇲 Oman',         police: '9999', ambulance: '9999' },
];

export const SAFETY_TIPS: SafetyTip[] = [
  {
    icon:    '☕',
    title:   'Meet in public first',
    content: 'Always meet in a busy public place — café, mall, or restaurant — for at least the first few dates. Avoid private locations until you\'ve built trust.',
  },
  {
    icon:    '📞',
    title:   'Tell someone your plans',
    content: 'Use the Date Check-In feature to share who you\'re meeting, where, and when. A trusted friend or family member should know your plans.',
  },
  {
    icon:    '🚗',
    title:   'Arrange your own transport',
    content: 'Drive yourself or use your own taxi. Don\'t get in a match\'s car until you know them well, and always have an exit plan.',
  },
  {
    icon:    '📱',
    title:   'Keep your phone charged',
    content: 'Make sure your phone is charged before a date. Share your live location with a trusted contact for the duration of the meeting.',
  },
  {
    icon:    '🍹',
    title:   'Watch your drinks',
    content: 'Never leave your drink unattended. If your drink tastes or smells unusual, stop drinking it and tell venue staff immediately.',
  },
  {
    icon:    '🔐',
    title:   'Protect your personal information',
    content: 'Don\'t share your home address, workplace, or financial information early on. Be cautious of anyone who asks for money or gifts.',
  },
];

export const RED_FLAGS: RedFlag[] = [
  { title: 'Asks for money or financial help', description: 'Romance scammers create emotional connections then request money. Never send money to someone you haven\'t met in person.' },
  { title: 'Refuses video call or in-person meeting', description: 'Consistent avoidance of video verification may indicate a fake profile or catfishing attempt.' },
  { title: 'Pushes to move off the app quickly', description: 'Asking to switch to WhatsApp or other apps right away removes the safety layer the platform provides.' },
  { title: 'Inconsistent story or profile details', description: 'Stories that change, ages that don\'t match photos, or vague answers about their life are warning signs.' },
  { title: 'Excessive love-bombing', description: 'Overwhelming affection very early — "I\'ve never felt this way" after days — can be a manipulation tactic.' },
  { title: 'Pressures for explicit content', description: 'Requesting intimate photos or video is a common precursor to sextortion. Report and block immediately.' },
];
