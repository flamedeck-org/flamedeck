# Chat Limit UI Integration

This document outlines the necessary client-side changes to handle chat limit errors returned from the backend.

## Overview

We've implemented chat limits on the backend, which will return specific error messages when a user hits their chat message limit, lifetime analysis limit, or monthly session limit. The client-side UI needs to be updated to catch and display these errors in a user-friendly way.

## Error Format

The backend sends chat limit errors via the Realtime channel with this structure:

```typescript
{
  type: 'broadcast',
  event: 'chat_error',
  payload: {
    error_code: 'limit_exceeded', // or 'internal_error', 'config_error'
    limit_type: 'session_messages', // or 'lifetime_analyses', 'monthly_sessions'
    message: 'You have reached your message limit of X for this chat session on the Y plan.'
  }
}
```

## Required Changes

### 1. Update `ChatContainer.tsx` to handle chat limit errors

Find the Realtime subscription handler in `ChatContainer.tsx` and add logic to handle the new 'chat_error' events:

```tsx
// Inside the Realtime subscription handler, add a case for 'chat_error'
supabase
  .channel(`private-chat-results-${userId}`)
  .on('broadcast', { event: 'ai_response' }, (payload) => {
    // ... existing code ...
    
    switch (payload.payload.type) {
      // ... existing cases ...
      
      case 'error':
        // Update this case or add a specific 'chat_error' case
        setError(payload.payload.message);
        // Disable chat input if this is a limit error
        if (payload.payload.error_code === 'limit_exceeded') {
          setIsChatLimitReached(true);
          setLimitType(payload.payload.limit_type);
        }
        break;
      
      case 'chat_error':
        setError(payload.payload.message);
        // Disable chat input if this is a limit error
        if (payload.payload.error_code === 'limit_exceeded') {
          setIsChatLimitReached(true); 
          setLimitType(payload.payload.limit_type);
        }
        break;
        
      // ... other cases ...
    }
  });
```

### 2. Add state variables for tracking chat limits

Add these state variables to `ChatContainer.tsx`:

```tsx
const [isChatLimitReached, setIsChatLimitReached] = useState(false);
const [limitType, setLimitType] = useState<string | null>(null);
```

### 3. Enhance the `ChatWindow.tsx` component to display limit errors

The chat window UI should display a prominent message when a chat limit is reached:

```tsx
// In ChatWindow.tsx
{error && (
  <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
    <p className="text-red-700">{error}</p>
    {isChatLimitReached && (
      <div className="mt-2">
        <p className="text-red-700 font-medium">
          {limitType === 'session_messages' && 'You\'ve reached the message limit for this chat session.'}
          {limitType === 'lifetime_analyses' && 'You\'ve reached your limit of free trace analyses.'}
          {limitType === 'monthly_sessions' && 'You\'ve reached your monthly chat session limit.'}
        </p>
        <Link 
          href="/pricing" 
          className="mt-2 inline-flex items-center gap-x-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          Upgrade Your Plan
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    )}
  </div>
)}
```

### 4. Disable chat input when limit is reached

Modify the chat input field in `ChatContainer.tsx` or `ChatWindow.tsx` to be disabled when a limit is reached:

```tsx
<form onSubmit={handleSubmit}>
  <input 
    type="text"
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder={isChatLimitReached ? "Chat limit reached" : "Type your message..."}
    disabled={isChatLimitReached || isWaitingForResponse}
    className={`w-full px-4 py-2 border rounded-md ${
      isChatLimitReached ? 'bg-gray-100 text-gray-500' : 'bg-white'
    }`}
  />
  <button 
    type="submit" 
    disabled={isChatLimitReached || !input.trim() || isWaitingForResponse}
    className={`ml-2 px-4 py-2 bg-blue-500 text-white rounded-md ${
      isChatLimitReached || !input.trim() || isWaitingForResponse ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
    }`}
  >
    Send
  </button>
</form>
```

### 5. Add a specific error component for chat limits

For better UX, consider adding a dedicated component:

```tsx
// components/Chat/ChatLimitError.tsx
import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/20/solid';

interface ChatLimitErrorProps {
  message: string;
  limitType: string | null;
}

export const ChatLimitError: React.FC<ChatLimitErrorProps> = ({ message, limitType }) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
      <p className="text-red-700">{message}</p>
      <div className="mt-2">
        <Link 
          href="/pricing" 
          className="mt-2 inline-flex items-center gap-x-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          Upgrade Your Plan
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};
```

Then use this component in your `ChatWindow.tsx`.

## Handling Different Limit Types

Different limit types require different messaging:

1. **session_messages**: This is reached within a single chat session. The user can close the chat and start a new one (if they haven't hit other limits).

2. **lifetime_analyses**: For free users, they can't start new chats on additional traces without upgrading.

3. **monthly_sessions**: For Pro users, they've used all their monthly sessions. They'll need to wait for their subscription to reset.

Adjust the UI messaging accordingly to give clear next steps for each limit type.

## Testing

Test all the limit scenarios:
1. Free user reaching 25 messages in a chat
2. Free user with 5 lifetime analyses trying to start a 6th
3. Pro user reaching 50 messages in a chat
4. Pro user reaching 25 monthly sessions

Ensure appropriate error messages are displayed and that the chat input is properly disabled. 