// Load saved token on page load
chrome.storage.local.get(['clientToken'], (result) => {
  if (result.clientToken) {
    document.getElementById('token').value = result.clientToken
  }
})

// Save button handler
document.getElementById('save').addEventListener('click', async () => {
  const token = document.getElementById('token').value.trim()
  const status = document.getElementById('status')
  
  if (!token) {
    status.textContent = 'Please enter a token'
    status.className = 'status error'
    status.style.display = 'block'
    return
  }
  
  // Save to storage
  await chrome.storage.local.set({ clientToken: token })
  
  status.textContent = '✓ Token saved! Now open any page and click the ꩜ icon.'
  status.className = 'status success'
  status.style.display = 'block'
})

// Also save on Enter key
document.getElementById('token').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('save').click()
  }
})
