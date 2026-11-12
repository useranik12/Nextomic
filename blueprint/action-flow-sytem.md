# **Action Flow System**

## Total Lists

|Triggers|Actions|
|-|-|



### Triggers

#### Common Triggers

* On Click
* On Double Click
* On Click And Hold
* On Secondary Click (Right mouse click or double finger on trackpad type)
* On Secondary Double Click
* On Secondary Click And Hold
* On Pinch Zoom Start
* On Pinch Zoom End
* On Pinch Zoom Update
* When Content Loaded (DOM)/ When Page/Template Loaded (DOM - For root element)
* When Comes To Viewport (On Screen)
* When Position Updated (Like top touches 40% or other values of the display)



#### Element Specific Triggers

**Elements if overflow is scroll**

* On Pull To Refresh

**Slider (Nestable) \[Not built yet]**

* On swipe

**Accordion (Nestable) \[Not built yet]**

* On Expanded Child

**Video Player \[Not built yet]**

* On Video Loaded
* On Video Played
* On Video Paused
* On Video Ended
* On Video Stopped
* On Video Played Length (means, a video is played to X time)
* On Video Seeked
* On Video Load Error (Means if error happens during video loading from source)

**Audio Player \[Not built yet]**

* On Audio Loaded
* On Audio Played
* On Audio Paused
* On Audio Ended
* On Audio Stopped
* On Audio Played Length (means, a Audio is played to X time)
* On Audio Seeked
* On Audio Load Error (Means if error happens during Audio loading from source)

**Timer \[Not built yet]**

* On Timer Start
* On Timer End

**Table (Nestable) \[Not built yet]**

* On Page Change
* On Sort Change
* On Filter Change
* On Rows Per Page Change

**Switch \[Not built yet]**

* On Toggled On
* On Toggled Off
* On Toggle

**Tab \[Not built yet]**

* On Tab Change

**All Form Elements \[Not built yet]**

**Input \[Not built yet]**

* On Submit
* On Change
* On Focus Change

**Dropdown, Radio, Choice Chips \[Not built yet]**

* On Selected

**Check \[Not built yet]**

* On Checked
* On Unchecked
* On Toggle

**PIN/OTP Field \[Not built yet]**

* On Change
* On Complete (When all fields are filled)
* On Focus Change

**Range Slider \[Not built yet]**

* On Value Change

**Rating Bar \[Not built yet]**

* On Bar Select

**Count Controller \[Not built yet]**

* On Count Change



### Actions

* Navigations >

  * Navigate To
  * Navigate Back
* Backend/CMS

  * Supabase Authentication

    * Login
    * Register
    * Log Out
    * Send Password Reset Email
    * Update Password
    * Update Email
    * Update Phone
  * Supabase

    * Query Row(s)
    * Insert Row(s)
    * Upsert Row(s)
    * Update Row(s)
    * Delete Row(s)
  * Refresh Supabase Query
  * Supabase File

    * Upload File
    * Download File
    * Clear Uploaded File (For Local Uploads)
    * Delete File
  * Supabase RPC

    * Call Supabase RPC
* State Management

  * Update App State
  * Update Page State
  * Rebuild Page
  * Form

    * Set Form Fields (Lists form fields with element name\[element type])
    * Reset Form Fields (Lists form fields with element name\[element type] to it's default)
    * Clear Form Fields (Lists form fields with element name\[element type] and clear it rather than restore or reset)
    * Validate Form (Validate the selected form (select the form wrapper and match it's validation rules)
  * Rebuild Component/Element (Rebuilds a component or an element and children by select or element picker)
* Element/UI Interactions

  * Bottom Sheet

    * Show
    * Dismiss
  * Date/Time Picker
  * Color Picker
  * Scroll To
  * Launch Map
  * Control Table
  * Control Slider
  * Control Accordion
  * Control Tab
  * Control Timer
  * Control Switch
  * Control Swipeable Stack
  * Start GSAP Timeline
  * Stop GSAP Timeline
* Alert/Notifications

  * Off Canvas

    * Open Off Canvas
    * Close Off Canvas
    * Toggle Off Canvas
  * Modal

    * Show Modal
    * Close Modal
    * Toggle Modal
  * Tooltip

    * Show Tooltip
    * Close Tooltip
    * Toggle Tooltip
  * Sound

    * Play Sound
    * Stop Sound
  * Trigger Push Notification
  * Set Theme
  * Set UI Mode (Light/Dark)
* Utilities

  * Wait
  * Copy To Clipborad
  * Put Data To Presigned S3 Storage (Upload a file to S3 compatible presigned URL)
  * Execute Custom Code
  * Debug Log (to console)
* Share

  * Share
  * Launch URL
  * Send Email
  * Call Number
  * Send SMS
* Media/Animation

  * Gallery

    * Start Slideshow
  * Video Player

    * Play Video
    * Pause Video
    * Stop Video
    * Play Previous/Next In Playlist
    * Add To Playlist (locally playlist widget \[not built])
    * Remove From Playlist (locally playlist widget \[not built])
    * Set Suffle Mode (On, off, toggle)
    * Set Loop Option (Off \[video stops on end], Once \[play whole playlist once], Always \[video loops always])
  * Audio Player

    * Play Audio
    * Pause Audio
    * Stop Audio
    * Play Previous/Next In Playlist
    * Add To Playlist (locally playlist widget \[not built])
    * Remove From Playlist (locally playlist widget \[not built])
    * Set Suffle Mode (On, off, toggle)
    * Set Loop Option (Off \[vudio stops on end], Once \[play whole playlist once], Always \[audio loops always])
  * Lottie

    * Play Lottie Animation
    * Pause Lottie Animation
    * Stop Lottie Animation
* Integrations (Yet to set)
* Action Blocks

  * \[Lists action blocks (with parameters if have, yet to plan)]
* Accessibility

  * Semantic Announce

