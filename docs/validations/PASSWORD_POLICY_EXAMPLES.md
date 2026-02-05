# Password Policy Examples

These examples illustrate the expected behavior of the password policy:

## Valid examples
- "MiClave!2026"
- "CompraSegura$99"
- "EventoSeguro_2026"

## Invalid examples
- "12345678" (too weak, missing complexity)
- "password" (common password)
- "clave123" (common password)
- "sinMayuscula9!" (missing uppercase)
- "SINMINUSCULA9!" (missing lowercase)
- "NoNumero!" (missing number)
- "SinEspecial9" (missing special character)
- "Con espacio9!" (contains spaces)
- "tixswap2026!" (contains brand)
