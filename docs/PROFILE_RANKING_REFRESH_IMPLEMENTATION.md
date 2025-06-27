# Profile Update → Ranking Re-fetch Implementation

## Overview
Implementation of automatic ranking cache invalidation and refresh when user profile is updated, ensuring immediate reflection of username changes in rankings.

## Features Implemented

### 1. Automatic Cache Invalidation
- **Trigger**: Username change in profile update
- **Action**: Invalidates React Query cache for rankings and history
- **Implementation**: Uses `queryClient.invalidateQueries()` 

### 2. Smart Success Messaging
- **Regular Updates**: "プロフィールを更新しました"
- **Username Changes**: "プロフィールを更新しました。ランキングページに移動してランキングを確認してください..."

### 3. Automatic Navigation
- **Condition**: Only when username is changed
- **Timing**: 2 seconds after successful update
- **Destination**: `/rankings` page

### 4. Manual Quick Access
- **Button**: "今すぐランキングを確認" appears with username change success message
- **Purpose**: Allows immediate navigation without waiting for auto-redirect

## Code Changes

### ProfilePage.tsx
```typescript
// Added imports
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { QUERY_KEYS } from '../hooks/useApiQuery';

// In component
const queryClient = useQueryClient();
const navigate = useNavigate();

// In handleSave success block
if (username !== user.username) {
  console.log('🔄 Username changed, invalidating ranking queries...');
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.rankings] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.history] });
}

// Auto-navigation after 2 seconds
setTimeout(() => {
  setSuccessMessage('');
  if (usernameChanged) {
    navigate('/rankings', { replace: false });
  }
}, 2000);
```

### Success Message Enhancement
- Conditional messaging based on whether username changed
- Quick access button for immediate navigation
- Visual feedback for user about upcoming navigation

## Testing

### Manual Testing Steps
1. **Login** and navigate to profile page
2. **Change username** and save profile
3. **Verify success toast** appears with navigation message
4. **Option A**: Wait 2 seconds for automatic navigation to `/rankings`
5. **Option B**: Click "今すぐランキングを確認" for immediate navigation
6. **Verify** rankings show updated username

### Automated Test Script
- **File**: `scripts/test_profile_ranking_refresh.js`
- **Coverage**: 
  - Login verification
  - Initial ranking state check
  - Username update API call
  - Post-update ranking verification
  - Cleanup (username reversion)

## Query Keys Used
- `[QUERY_KEYS.rankings]` - All ranking queries
- `[QUERY_KEYS.history]` - User history queries

## User Experience Flow

```
1. User updates username in profile
   ↓
2. Success message shows with navigation info
   ↓
3. Cache invalidation happens immediately
   ↓ (2 seconds)
4. Auto-navigation to rankings page
   ↓
5. Fresh ranking data loaded with updated username
```

## Benefits

- **Immediate Reflection**: Username changes visible in rankings instantly
- **User Guidance**: Clear messaging about what will happen
- **Flexible Navigation**: Both automatic and manual options
- **Performance**: Targeted cache invalidation only when needed
- **User Experience**: Smooth transition to see updated information

## Implementation Notes

- Only invalidates cache when username actually changes
- Preserves other profile updates without unnecessary cache invalidation
- Non-blocking: Profile update succeeds even if cache invalidation fails
- Graceful navigation: Uses `replace: false` to maintain browser history
- Responsive timing: 2-second delay provides good UX balance

## Future Enhancements

- Could extend to other profile fields that affect rankings (grade, etc.)
- Could add loading indicators during navigation
- Could implement optimistic updates for even faster UX
- Could add user preference for auto-navigation behavior