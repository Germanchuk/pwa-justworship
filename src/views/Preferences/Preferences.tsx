import React from 'react'
import {ToPageHeaderArea} from "#layout/PageHeaderArea/ToPageHeaderArea";

export default function Preferences() {
  return (
    <div>
      <ToPageHeaderArea>Налаштування</ToPageHeaderArea>
      <button className='btn btn-primary' onClick={() => window.location.reload()}>Hard reload</button>
    </div>
  )
}
