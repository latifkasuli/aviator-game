# Admin IP Ranges Configuration Guide

## Overview

`ADMIN_IP_RANGES` is an optional security feature that restricts admin panel access to specific IP addresses or ranges. Even with valid admin credentials, access is denied if the request doesn't come from an allowed IP.

## Common Use Cases

### 1. Home/Office Setup
If you're the only admin and work from a fixed location:
```env
# Your home/office public IP
ADMIN_IP_RANGES="203.0.113.45"
```

### 2. Multiple Admins
For a team with different locations:
```env
# Admin1 home, Admin2 home, Office network
ADMIN_IP_RANGES="203.0.113.45,198.51.100.22,192.0.2.0/24"
```

### 3. Dynamic IPs with VPN
If admins have dynamic IPs, use a VPN:
```env
# Your VPN server's IP range
ADMIN_IP_RANGES="10.8.0.0/24"
```

### 4. Development + Production
```env
# Localhost for dev, office for prod
ADMIN_IP_RANGES="127.0.0.1,::1,203.0.113.0/24"
```

## How to Find Your IP

### Option 1: Command Line
```bash
# On macOS/Linux
curl ifconfig.me

# Or
curl ipinfo.io/ip
```

### Option 2: Web Service
Visit: https://whatismyipaddress.com

### Option 3: Check Server Logs
The admin middleware logs denied attempts with the IP:
```
[WARNING] Admin access denied from IP: 203.0.113.99 for user: admin
```

## IP Range Formats

### Individual IPs
```env
ADMIN_IP_RANGES="192.168.1.100"
```

### CIDR Notation
```env
# /32 = Single IP (192.168.1.100)
ADMIN_IP_RANGES="192.168.1.100/32"

# /24 = 256 IPs (192.168.1.0 to 192.168.1.255)
ADMIN_IP_RANGES="192.168.1.0/24"

# /16 = 65,536 IPs (192.168.0.0 to 192.168.255.255)
ADMIN_IP_RANGES="192.168.0.0/16"
```

### IPv6 Support
```env
ADMIN_IP_RANGES="2001:db8::1,2001:db8::/32"
```

## Security Considerations

### Important Notes

1. **IP Spoofing**: IPs can be spoofed. Use this as an additional layer, not the only security.

2. **Proxy/CDN Issues**: If using Cloudflare or similar:
   - The client IP might be in headers like `X-Forwarded-For`
   - May need to configure trust proxy settings

3. **Dynamic IPs**: Home internet IPs often change:
   - Consider using a VPN with static IP
   - Or use a broader range (less secure)

4. **Mobile/Travel**: Admins on mobile or traveling:
   - Use VPN
   - Or temporarily disable (not recommended)
   - Or add temporary IPs (remember to remove)

## Troubleshooting

### Access Denied Despite Correct IP

1. **Check IP Detection**:
   ```bash
   # Add this temporarily to server.js
   console.log('Client IP:', req.ip, req.connection.remoteAddress);
   ```

2. **Behind Proxy/Load Balancer**:
   ```javascript
   // In server.js, add:
   app.set('trust proxy', true);
   ```

3. **IPv4 vs IPv6**:
   - You might be connecting via IPv6
   - Add both: `"192.168.1.100,::1"`

### Testing Configuration

1. **Set a test range**:
   ```env
   ADMIN_IP_RANGES="127.0.0.1"  # Only localhost
   ```

2. **Try to access admin panel**

3. **Check logs for your actual IP**

4. **Update configuration with correct IP**

## Best Practices

### For Production

1. **Use Static IPs**:
   - Office static IP
   - VPN with static IP
   - Cloud bastion host

2. **Narrow Ranges**:
   - [X] `0.0.0.0/0` (allows all)
   - [OK] `203.0.113.0/29` (8 IPs)

3. **Regular Audits**:
   - Review allowed IPs monthly
   - Remove ex-employee IPs
   - Check audit logs

4. **Combine with Other Security**:
   - Strong passwords
   - 2FA (when implemented)
   - Regular key rotation

### For Development

```env
# Development - more permissive
ADMIN_IP_RANGES="127.0.0.1,192.168.0.0/16,10.0.0.0/8"

# Production - restrictive
ADMIN_IP_RANGES="203.0.113.45,203.0.113.46"
```

## Quick Reference

### Allow Localhost Only
```env
ADMIN_IP_RANGES="127.0.0.1,::1"
```

### Allow Private Network
```env
ADMIN_IP_RANGES="192.168.0.0/16,10.0.0.0/8,172.16.0.0/12"
```

### Allow Specific Office
```env
ADMIN_IP_RANGES="office.public.ip.here/32"
```

### Disable IP Restrictions
```env
# Don't set ADMIN_IP_RANGES at all
# Or set it to empty:
ADMIN_IP_RANGES=""
```

## Emergency Access

If you lock yourself out:

1. **SSH to server**
2. **Temporarily disable**:
   ```bash
   # Edit .env file
   # Comment out ADMIN_IP_RANGES
   # Restart server
   ```

3. **Fix configuration**
4. **Re-enable restrictions**

Remember: IP restrictions are just one layer of security. Always use strong passwords and keep your admin credentials secure!
