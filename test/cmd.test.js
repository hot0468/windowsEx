import { describe, expect, it } from 'vitest'
import { ipconfigAll, ping } from '../src/apps/Cmd.jsx'
import scenario from '../src/scenarios/workday.json'

const net = scenario.network

describe('command prompt', () => {
  it('ipconfig /all is the only place the MAC shows up', () => {
    expect(ipconfigAll(net).join('\n')).toContain(net.mac)
    expect(JSON.stringify(scenario.fs)).not.toContain(net.mac)
  })

  it('ping answers four times and averages to the scenario figure', () => {
    const out = ping(net, net.gateway).join('\n')
    expect(out.match(/응답:/g)).toHaveLength(4)
    expect(out).toContain(`평균 = ${net.pingMs}ms`)
  })

  it('ping without a host explains itself instead of hanging', () => {
    expect(ping(net, undefined).join('\n')).toContain('사용법')
  })
})
