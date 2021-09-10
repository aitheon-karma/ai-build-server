# Treasury

### Usage

```
export function treasuryApiConfigFactory (): Configuration {
  const params: ConfigurationParameters = {
    basePath: `${ environment.baseApi }/treasury`
  };
  return new Configuration(params);
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    ...
    TreasuryModule.forRoot(treasuryApiConfigFactory),
    ...
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```