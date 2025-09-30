// Utility script to clear Groups table preferences
// Run this once to reset the Groups table to use updated base columns

const clearGroupsPreferences = async () => {
  try {
    const response = await fetch('/api/table-preferences/account-details:groups', {
      method: 'DELETE',
    });
    
    if (response.ok) {
      console.log('✅ Groups table preferences cleared successfully');
      console.log('The Groups table will now use the updated base columns with Actions column');
    } else {
      console.log('❌ Failed to clear preferences:', response.status);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
};

console.log('To clear Groups table preferences and show the new Actions column:');
console.log('1. Open browser console on the Account Details page'); 
console.log('2. Run: clearGroupsPreferences()');
console.log('3. Refresh the page');

// Make function available globally
window.clearGroupsPreferences = clearGroupsPreferences;