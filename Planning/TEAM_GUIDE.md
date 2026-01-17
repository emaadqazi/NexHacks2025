# ClearPath Team Collaboration Guide

This guide helps the 4-person development team work efficiently on ClearPath without conflicts.

---

## 🎯 Team Structure

### Team Member 1: Camera & Vision
- **Primary Files:** `src/services/CameraService.ts`
- **Branch:** `feature/camera-integration`
- **Dependencies:** Overshoot API

### Team Member 2: Voice & Audio
- **Primary Files:** `src/services/VoiceService.ts`
- **Branch:** `feature/voice-livekit`
- **Dependencies:** LiveKit API

### Team Member 3: Navigation & Algorithms
- **Primary Files:** `src/services/NavigationService.ts`, `src/utils/floorPlan.ts`
- **Branch:** `feature/navigation-algo`
- **Dependencies:** None (can work offline)

### Team Member 4: UI/UX & Integration
- **Primary Files:** `src/screens/HomeScreen.tsx`, `src/components/*`
- **Branch:** `feature/ui-testing`
- **Dependencies:** All other services (integrates everything)

---

## 🔀 Git Workflow

### Initial Setup
```bash
# Clone the repository
git clone <repository-url>
cd ClearPath

# Install dependencies
npm install

# Create your feature branch
git checkout -b feature/your-feature-name
```

### Daily Workflow
```bash
# Start of day: Get latest changes
git checkout main
git pull origin main
git checkout feature/your-feature-name
git merge main

# Work on your feature
# ... make changes ...

# Commit your work
git add .
git commit -m "feat: descriptive message about your changes"

# Push to remote
git push origin feature/your-feature-name

# Create Pull Request on GitHub when ready
```

### Commit Message Format
Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

Examples:
```bash
git commit -m "feat: implement object detection with Overshoot API"
git commit -m "fix: camera permission handling on iOS"
git commit -m "docs: add voice command examples to README"
```

---

## 🚀 Getting Started - First Day Tasks

### Team Member 1: Camera Integration
1. **Set up Overshoot API**
   - Sign up at overshoot.io
   - Get API key
   - Add to `.env` file

2. **Test camera access**
   ```bash
   npm start
   # Test on physical device
   # Verify camera permissions work
   ```

3. **Implement basic object detection**
   - Open `src/services/CameraService.ts`
   - Implement `startCamera()` method
   - Test camera feed displays properly

4. **First API integration**
   - Implement `detectObjects()` method
   - Send camera frame to Overshoot API
   - Parse and return detected objects

### Team Member 2: Voice Integration
1. **Set up LiveKit**
   - Sign up at livekit.io
   - Get API credentials
   - Add to `.env` file

2. **Test microphone access**
   ```bash
   npm start
   # Test voice button on device
   # Verify microphone permissions
   ```

3. **Implement basic TTS**
   - Open `src/services/VoiceService.ts`
   - Implement `speak()` method
   - Test audio output works

4. **Add voice recognition**
   - Implement `startListening()` method
   - Connect to LiveKit
   - Parse simple commands

### Team Member 3: Navigation Logic
1. **Study floor plan structure**
   - Open `src/assets/sample-floorplan.json`
   - Understand landmark and connection data
   - Review `src/utils/floorPlan.ts` helper functions

2. **Implement pathfinding**
   - Open `src/services/NavigationService.ts`
   - Implement `calculatePath()` using A* algorithm
   - Test with sample floor plan

3. **Generate instructions**
   - Implement `getNextInstruction()` method
   - Create turn-by-turn text instructions
   - Consider accessibility needs

4. **Test navigation**
   ```typescript
   // Test in a separate file or console
   import NavigationService from './services/NavigationService';
   
   NavigationService.navigateTo('Conference Room 101');
   const instruction = await NavigationService.getNextInstruction();
   console.log(instruction);
   ```

### Team Member 4: UI/UX Integration
1. **Test the app end-to-end**
   ```bash
   npm start
   # Test on physical device
   # Check all UI elements display
   ```

2. **Enhance components**
   - Open `src/components/CameraView.tsx`
   - Add loading states
   - Improve error handling

3. **Integrate services in HomeScreen**
   - Open `src/screens/HomeScreen.tsx`
   - Connect voice commands to navigation
   - Display detected objects
   - Show navigation instructions

4. **Accessibility testing**
   - Test with VoiceOver (iOS) or TalkBack (Android)
   - Ensure all interactive elements are accessible
   - Verify voice feedback is clear

---

## 🔧 Development Best Practices

### Testing Your Changes
Before pushing code:
```bash
# Run type checking
npx tsc --noEmit

# Test on device
npm start
# Scan QR code with Expo Go

# Test your specific feature thoroughly
```

### Code Style
- Use TypeScript strict mode
- Add JSDoc comments to public methods
- Use async/await (not callbacks)
- Handle errors gracefully with try-catch
- Log important actions for debugging

Example:
```typescript
/**
 * Detect objects in the current camera frame
 * @returns Array of detected objects with labels and positions
 * @throws Error if camera is not initialized
 */
async detectObjects(): Promise<DetectedObject[]> {
  try {
    if (!this.isRunning) {
      throw new Error('Camera not started');
    }
    
    // Implementation here
    console.log('Detecting objects...');
    return [];
  } catch (error) {
    console.error('Object detection failed:', error);
    throw error;
  }
}
```

### Service Integration Pattern
When integrating services, use this pattern:

```typescript
// In HomeScreen.tsx
import NavigationService from '../services/NavigationService';
import VoiceService from '../services/VoiceService';
import CameraService from '../services/CameraService';

// Initialize services
useEffect(() => {
  initializeServices();
}, []);

const initializeServices = async () => {
  try {
    await CameraService.startCamera();
    await VoiceService.startListening();
    await VoiceService.speak('ClearPath is ready');
  } catch (error) {
    console.error('Service initialization failed:', error);
    // Show error to user
  }
};
```

---

## 🤝 Communication

### Daily Standup (15 minutes)
Every day at [TIME], team discusses:
1. What did you complete yesterday?
2. What are you working on today?
3. Any blockers or questions?

### Code Reviews
- All pull requests need 1 approval before merging
- Review checklist:
  - [ ] Code compiles without errors
  - [ ] No console errors
  - [ ] Code follows TypeScript best practices
  - [ ] Functions have JSDoc comments
  - [ ] Feature works on physical device

### Getting Help
- **Stuck on API integration?** Ask team members 1 or 2
- **Navigation algorithm issues?** Ask team member 3
- **UI problems?** Ask team member 4
- **General questions?** Post in team chat

---

## 🐛 Debugging Tips

### Camera Issues
```typescript
// Add detailed logging
console.log('Camera status:', CameraService.getStatus());
console.log('Permissions:', await Camera.getCameraPermissionsAsync());
```

### Voice Issues
```typescript
// Test TTS separately
await VoiceService.speak('Test message');

// Check microphone permissions
console.log('Mic permissions:', await Audio.getPermissionsAsync());
```

### Navigation Issues
```typescript
// Log floor plan data
console.log('Landmarks:', sampleFloorPlan.floors[0].landmarks);
console.log('Connections:', sampleFloorPlan.floors[0].connections);

// Test pathfinding
const path = await NavigationService.calculatePath(
  { x: 0, y: 0, floor: 1 },
  getLandmarkById('room-101')
);
console.log('Calculated path:', path);
```

### General Debugging
```bash
# Clear cache if things are weird
npm start -- --clear

# Check Metro bundler logs
# Look for red error messages

# Use React DevTools
# Shake device -> Debug Remote JS
```

---

## 📦 Adding New Dependencies

If you need a new package:
```bash
# Install it
npm install package-name

# Test that it works
npm start

# Commit package.json and package-lock.json
git add package.json package-lock.json
git commit -m "chore: add package-name for [reason]"
```

Always discuss with team before adding major dependencies!

---

## 🎨 UI Design Guidelines

### Accessibility First
- Large touch targets (minimum 44x44 points)
- High contrast text (white on dark backgrounds)
- Voice feedback for all actions
- No reliance on color alone for information

### Color Palette
```javascript
const colors = {
  primary: '#007AFF',    // Blue - primary actions
  danger: '#FF3B30',     // Red - stop/cancel
  success: '#34C759',    // Green - success
  warning: '#FF9500',    // Orange - warnings
  background: '#000000', // Black - main background
  text: '#FFFFFF',       // White - main text
  textSecondary: '#CCCCCC', // Gray - secondary text
};
```

### Typography
- Instructions: 20px, bold
- Secondary text: 16px, regular
- Distance info: 16px, light

---

## 🚢 Ready to Deploy?

Before merging to main:
1. ✅ All tests pass
2. ✅ TypeScript compiles without errors
3. ✅ Feature works on both iOS and Android
4. ✅ Code reviewed by at least 1 team member
5. ✅ Documentation updated
6. ✅ No console errors

---

## 📞 Emergency Contacts

- **Project Lead:** [Name]
- **Technical Questions:** [Name]
- **API Issues:** [Name]
- **Deadline Questions:** [Name]

---

## 🎉 Good Luck!

You're building something that will genuinely help people. Take pride in your work, help your teammates, and create something amazing!

**Remember:** Communication is key. When in doubt, ask! 🚀
